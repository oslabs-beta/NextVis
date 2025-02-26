import * as vscode from 'vscode';
import * as path from 'path';
import parsingScript from './webview/parsingScript';

let metricsPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {

  const d3 = vscode.commands.registerCommand('NextVis.start', async () => {
    const panel = vscode.window.createWebviewPanel(
      'NextVis',
      'NextVis',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js'))
    );

    panel.webview.html = getWebviewContent(scriptUri);

    let metricsData = {};

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'pickFile':
          const options = {
            canSelectMany: false,
            openLabel: 'Select Middleware',
            filters: {
              TypeScript: ['ts'],
            },
          };
          const fileUri = await vscode.window.showOpenDialog(options);
          if (fileUri && fileUri[0]) {
            const filePath = fileUri[0].fsPath;
            try {
              const startCpu = process.cpuUsage();
              const startMemory = process.memoryUsage();

              const flare = await parsingScript(filePath);
              console.log('flare: ', flare);

              const endCpu = process.cpuUsage(startCpu);
              const endMemory = process.memoryUsage();

              const cpuUsage = {
                user: endCpu.user,
                system: endCpu.system,
                total: endCpu.user + endCpu.system,
              };

              const memoryUsage = {
                rss: endMemory.rss - startMemory.rss,
                heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                external: endMemory.external - startMemory.external,
              };

              metricsData = {
                cpu: {
                  user: `${(cpuUsage.user / 1000).toFixed(2)}ms`,
                  system: (cpuUsage.system / 1000).toFixed(2),
                  total: ((cpuUsage.user + cpuUsage.system) / 1000).toFixed(2),
                },
                memory: {
                  heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(
                    2
                  )}MB`,
                  heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
                  rss: (memoryUsage.rss / 1024 / 1024).toFixed(2),
                  external: (memoryUsage.external / 1024 / 1024).toFixed(2),
                },
              };

              const baseDir = path.dirname(filePath);

              const compName = path.parse(filePath).base;
              panel.webview.postMessage({
                command: 'filePicked',
                flare,
                filePath,
                baseDir,
                compName,
              });
            } catch (error) {
              console.log('Error: ', error);
            }
          }
          break;

        case 'openMetricsPanel':
          if (metricsPanel) {
            metricsPanel.reveal(vscode.ViewColumn.Two);
          } else {
            metricsPanel = vscode.window.createWebviewPanel(
              'metrics',
              'NextVis Metrics',
              vscode.ViewColumn.Two,
              {
                enableScripts: true,
                retainContextWhenHidden: true,
              }
            );

            metricsPanel.onDidDispose(() => {
              metricsPanel = undefined;
            });

            metricsPanel.webview.html = getMetricsContent();

            metricsPanel.webview.postMessage({
              command: 'openMetricsPanel',
              metrics: metricsData,
            });
          }
          break;

        case 'alert':
          vscode.window.showErrorMessage(message.text);
          break;
      }
    });
  });

  context.subscriptions.push(d3);
}

function getWebviewContent(uri: vscode.Uri) {
  return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Middleware Dendrogram</title>
      </head>
      <body>
        <script src="${uri}"></script>
      </body>
      </html>`;
}

function getMetricsContent(): string {
 return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Metrics</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 16px;
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
                }
                .metrics-container {
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
                }
                .metric-section {
                  background: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-panel-border);
                  border-radius: 4px;
                  padding: 12px;
                  margin-bottom: 16px;
                }
                .metric-section h2 {
                  margin: 0 0 12px 0;
                  font-size: 1.2em;
                  color: var(--vscode-foreground);
                }
                .metric {
                  display: flex;
                  justify-content: space-between;
                  font-size: 14px;
                  padding: 8px 0;
                  border-bottom: 1px solid var(--vscode-panel-border);
                }
                .metric:last-child {
                  border-bottom: none;
                }
                .value {
                  font-family: monospace;
                  color: var(--vscode-textLink-foreground);
                }
              </style>
            </head>
            <body>
              <div class="metrics-container">
                <h1>NextVis Metrics</h1>
                
                <div class="metric-section">
                  <h2>CPU Usage</h2>
                  <div class="metric">
                    <span>User Time:</span>
                    <span id="cpu-user" class="value">Loading...</span>
                  </div>
                  <div class="metric">
                    <span>System Time:</span>
                    <span id="cpu-system" class="value">Loading...</span>
                  </div>
                  <div class="metric">
                    <span>Total CPU Time:</span>
                    <span id="cpu-total" class="value">Loading...</span>
                  </div>
                </div>
            
                <div class="metric-section">
                  <h2>Memory Usage</h2>
                  <div class="metric">
                    <span>Heap Used:</span>
                    <span id="memory-heap-used" class="value">Loading...</span>
                  </div>
                  <div class="metric">
                    <span>Heap Total:</span>
                    <span id="memory-heap-total" class="value">Loading...</span>
                  </div>
                  <div class="metric">
                    <span>RSS:</span>
                    <span id="memory-rss" class="value">Loading...</span>
                  </div>
                  <div class="metric">
                    <span>External:</span>
                    <span id="memory-external" class="value">Loading...</span>
                  </div>
                </div>
              </div>
            
              <script>
                window.addEventListener('message', (event) => {
                  const message = event.data;
            
                  if (message.command === 'openMetricsPanel') {
                    // Update CPU metrics
                    if (message.metrics && message.metrics.cpu) {
                      document.getElementById('cpu-user').textContent = message.metrics.cpu.user;
                      document.getElementById('cpu-system').textContent = message.metrics.cpu.system;
                      document.getElementById('cpu-total').textContent = message.metrics.cpu.total;
                    }
            
                    // Update Memory metrics
                    if (message.metrics && message.metrics.memory) {
                      document.getElementById('memory-heap-used').textContent = message.metrics.memory.heapUsed;
                      document.getElementById('memory-heap-total').textContent = message.metrics.memory.heapTotal;
                      document.getElementById('memory-rss').textContent = message.metrics.memory.rss;
                      document.getElementById('memory-external').textContent = message.metrics.memory.external;
                    }
                  }
                });
              </script>
            </body>
            </html>
            `;
}

export function deactivate() {}
