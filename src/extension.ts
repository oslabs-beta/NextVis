import * as vscode from "vscode";
import * as path from "path";
import parsingScript from "./webview/parsingScript";

// Import our instrumentation modules
import { MetricsSetup } from "./instrumentation/metrics-injector";
import { DevServer } from "./instrumentation/setup-user-dev-server";
import { startMetricsServer } from "./instrumentation/metrics-server";

let metricsPanel: vscode.WebviewPanel | undefined;
let requestsMetricsPanel: vscode.WebviewPanel | undefined;
let functionsMetricsPanel: vscode.WebviewPanel | undefined;
let projectRoot: string | undefined;
let metricsServer: any = null;
let metricsData: any = {
  byRequest: [],
  byFunction: [],
  completedExecutions: [],
};

export function activate(context: vscode.ExtensionContext) {
  const d3 = vscode.commands.registerCommand("NextVis.start", async () => {
    const panel = vscode.window.createWebviewPanel(
      "NextVis",
      "NextVis",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "dist", "webview.js"))
    );

    panel.webview.html = getWebviewContent(scriptUri);

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "pickFile":
          const options = {
            canSelectMany: false,
            openLabel: "Select Middleware",
            filters: {
              TypeScript: ["ts"],
            },
          };
          const fileUri = await vscode.window.showOpenDialog(options);
          if (fileUri && fileUri[0]) {
            const filePath = fileUri[0].fsPath;
            try {
              const flare = await parsingScript(filePath);

              projectRoot = path.dirname(filePath);
              const baseDir = projectRoot;
              const compName = path.parse(filePath).base;
              panel.webview.postMessage({
                command: "filePicked",
                flare,
                filePath,
                baseDir,
                compName,
              });
              const extensionPath = context.extensionPath;

              const metrics = new MetricsSetup(
                flare,
                projectRoot,
                extensionPath
              );
              const devCommand = await vscode.window.showInputBox({
                prompt:
                  "Enter the command to start your Next.js dev server (e.g., 'npm run dev')",
                placeHolder: "npm run dev",
                value: "npm run dev",
              });
              const devServer = new DevServer(devCommand, projectRoot);
              await devServer.startDevServer();

              const statusBar = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Left,
                100
              );
              statusBar.show();
              metricsServer = startMetricsServer(statusBar, vscode);
              context.subscriptions.push({ dispose: metricsServer.stop });

              // Start a periodic update of metrics data
              const metricsUpdateInterval = setInterval(() => {
                if (metricsServer) {
                  metricsData.completedExecutions =
                    metricsServer.getMetrics().completedExecutions;

                  // Update the metrics panel if it's open
                  if (metricsPanel) {
                    metricsPanel.webview.postMessage({
                      command: "updateMetrics",
                      metrics: metricsData,
                    });
                  }
                }
              }, 1000); // Update every second

              context.subscriptions.push({
                dispose: () => clearInterval(metricsUpdateInterval),
              });
            } catch (error) {
              console.log("Error: ", error);
              vscode.window.showErrorMessage(
                `Error analyzing middleware: ${error}`
              );
            }
          }
          break;

        case "openMetricsPanel":
          if (metricsPanel) {
            metricsPanel.reveal(vscode.ViewColumn.Two);
          } else {
            metricsPanel = vscode.window.createWebviewPanel(
              "metrics",
              "NextVis Metrics",
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
              command: "openMetricsPanel",
              metrics: metricsData,
            });
          }
          break;

        case "alert":
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
               <title>Function Execution Metrics</title>
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
                 table {
                   width: 100%;
                   border-collapse: collapse;
                   margin-bottom: 12px;
                 }
                 th, td {
                   text-align: left;
                   padding: 8px;
                   border-bottom: 1px solid var(--vscode-panel-border);
                 }
                 th {
                   font-weight: bold;
                   color: var(--vscode-descriptionForeground);
                 }
                 .short-duration {
                   color: #4caf50;
                 }
                 .medium-duration {
                   color: #ff9800;
                 }
                 .long-duration {
                   color: #f44336;
                 }
               </style>
             </head>
             <body>
               <div class="metrics-container">
                 <h1>Execution Metrics</h1>
                 
                 <div class="metric-section">
                   <h2>Function Executions</h2>
                   <table>
                     <thead>
                       <tr>
                         <th>Function Name</th>
                         <th>Invocation Count</th>
                         <th>Average Duration (ms)</th>
                         <th>Min Duration (ms)</th>
                         <th>Max Duration (ms)</th>
                       </tr>
                     </thead>
                     <tbody id="function-metrics">
                       <tr><td colspan="5">Loading...</td></tr>
                     </tbody>
                   </table>
                 </div>
               </div>
             
               <script>
                 // Format duration to 3 decimal places
                 function formatDuration(ms) {
                   return ms.toFixed(3);
                 }
                 
                 // Process and display metrics data
                 function processMetrics(data) {
                   if (!data || !data.completedExecutions || !data.completedExecutions.length) {
                     document.getElementById('function-metrics').innerHTML = '<tr><td colspan="5">No metrics data available.</td></tr>';
                     return;
                   }
                   
                   // Group by function name
                   const functionStats = {};
                   
                   data.completedExecutions.forEach(exec => {
                     if (!functionStats[exec.functionName]) {
                       functionStats[exec.functionName] = {
                         name: exec.functionName,
                         count: 0,
                         totalDuration: 0,
                         minDuration: Number.MAX_VALUE,
                         maxDuration: 0
                       };
                     }
                     
                     const stats = functionStats[exec.functionName];
                     stats.count++;
                     stats.totalDuration += exec.duration;
                     stats.minDuration = Math.min(stats.minDuration, exec.duration);
                     stats.maxDuration = Math.max(stats.maxDuration, exec.duration);
                   });
                   
                   // Convert to array and sort by total execution time
                   const functionArray = Object.values(functionStats);
                   functionArray.sort((a, b) => (b.totalDuration / b.count) - (a.totalDuration / a.count));
                   
                   // Generate function metrics table rows
                   let html = '';
                   
                   functionArray.forEach(func => {
                     const avgDuration = func.totalDuration / func.count;
                     const durationClass = avgDuration < 1 ? 'short-duration' : 
                                          (avgDuration < 10 ? 'medium-duration' : 'long-duration');
                     
                     html += \`
                       <tr>
                         <td>\${func.name}</td>
                         <td>\${func.count}</td>
                         <td class="\${durationClass}">\${formatDuration(avgDuration)}</td>
                         <td>\${formatDuration(func.minDuration)}</td>
                         <td>\${formatDuration(func.maxDuration)}</td>
                       </tr>
                     \`;
                   });
                   
                   document.getElementById('function-metrics').innerHTML = html || '<tr><td colspan="5">No function metrics available.</td></tr>';
                 }
             
                 window.addEventListener('message', (event) => {
                   const message = event.data;
             
                   if (message.command === 'openMetricsPanel' || message.command === 'updateMetrics') {
                     processMetrics(message.metrics);
                   }
                 });
               </script>
             </body>
             </html>
             `;
}

export function deactivate() {
  // Cleanup instrumentation when extension is deactivated
  if (projectRoot) {
    const path = require("path");
    const fs = require("fs");
    const instrumentationDir = path.join(projectRoot, "nextvis");

    // Restore modified files first (similar logic as in cleanUpInstrumentation)
    const modifiedFilesPath = path.join(
      instrumentationDir,
      "modified-files.json"
    );
    const backupDir = path.join(instrumentationDir, "backups");

    if (fs.existsSync(modifiedFilesPath)) {
      try {
        const modifiedFiles = JSON.parse(
          fs.readFileSync(modifiedFilesPath, "utf8")
        );

        modifiedFiles.forEach((filePath) => {
          const fileName = path.basename(filePath);
          const backupPath = path.join(backupDir, fileName + ".original");

          if (fs.existsSync(backupPath) && fs.existsSync(filePath)) {
            fs.copyFileSync(backupPath, filePath);
            console.log(`[NextVis] Restored original file: ${filePath}`);
          }
        });
      } catch (error) {
        console.error("[NextVis] Error restoring modified files:", error);
      }
    }

    // Then remove the directory
    if (fs.existsSync(instrumentationDir)) {
      fs.rmSync(instrumentationDir, { recursive: true, force: true });
      console.log("[NextVis] Cleaned up instrumentation.");
    }
  }
}
