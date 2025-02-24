import * as vscode from "vscode";
import * as path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { InspectorInstrumenter } from "./monitor/inspectorInstrumenter";
import parsingScript from "./webview/parsingScript";
// Import the FinalObject type (if you need it)
import { FinalObject } from "./webview/parsingScript";
import { createAndAttachInspector } from "./monitor/nodeOnly";

let devServerProcess: ChildProcessWithoutNullStreams | null = null;
let inspectorInstrumenter: InspectorInstrumenter | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "nextFlow" is now active!');

  // NEW COMMAND: "nextFlow.startMonitoredDevServer"
  const startMonitoredDevCommand = vscode.commands.registerCommand(
    "nextFlow.startMonitoredDevServer",
    async () => {
      const outputChannel = vscode.window.createOutputChannel(
        "NextFlow Dev Server"
      );
      outputChannel.show();

      try {
        const devCommand = await detectOrAskDevCommand();
        if (!devCommand) {
          vscode.window.showErrorMessage("Could not find a dev command.");
          return;
        }

        // Start Next.js with the inspect flag
        devServerProcess = spawn(devCommand.bin, devCommand.args, {
          cwd: devCommand.cwd,
          shell: true,
          env: {
            ...process.env,
            // Let Node pick an available port for the inspector
            NODE_OPTIONS: "--inspect",
          },
        });

        // Promise to capture both debug-port detection and Next.js readiness
        const serverInfo = await new Promise<{
          port: number;
          isReady: boolean;
        }>((resolve, reject) => {
          let timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for Next.js to start"));
          }, 30000);

          let portsFound: number[] = [];
          let failedPorts = new Set<number>();
          let isNextReady = false;

          const checkReadyAndPort = () => {
            // Get the last valid port (that hasn't failed)
            const validPorts = portsFound.filter((p) => !failedPorts.has(p));
            const lastValidPort = validPorts[validPorts.length - 1];

            if (isNextReady && lastValidPort) {
              clearTimeout(timeout);
              resolve({ port: lastValidPort, isReady: true });
            }
          };

          const onData = (data: Buffer) => {
            const output = data.toString();
            outputChannel.append(output);

            // Check for "failed" debug ports
            const failMatch = output.match(
              /Starting inspector on 127\.0\.0\.1:(\d+) failed/
            );
            if (failMatch) {
              const port = parseInt(failMatch[1], 10);
              failedPorts.add(port);
              outputChannel.appendLine(
                `\n[NextFlow] Port ${port} failed, will try another`
              );
            }

            // Check for new debug ports
            const portRegexes = [
              /Debugger listening on ws:\/\/127\.0\.0\.1:(\d+)/,
              /the Next\.js router server should be inspected at (\d+)/,
              /inspector on 127\.0\.0\.1:(\d+)/,
            ];

            for (const regex of portRegexes) {
              const match = output.match(regex);
              if (match) {
                const port = parseInt(match[1], 10);
                if (!portsFound.includes(port)) {
                  portsFound.push(port);
                  outputChannel.appendLine(
                    `\n[NextFlow] Found debug port: ${port}`
                  );
                }
              }
            }

            // Check if Next.js is ready
            if (output.includes("✓ Ready")) {
              isNextReady = true;
              outputChannel.appendLine("\n[NextFlow] Next.js is ready");
            }

            checkReadyAndPort();
          };

          devServerProcess?.stdout.on("data", onData);
          devServerProcess?.stderr.on("data", onData);

          devServerProcess?.on("error", (err) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to start dev server: ${err.message}`));
          });
        });

        outputChannel.appendLine(
          `\n[NextFlow] Next.js is ready. Attempting to connect inspector to port ${serverInfo.port}`
        );

        // Add a small delay to ensure the debugger is fully initialized
        await new Promise((res) => setTimeout(res, 1000));

        // Try to connect with up to 3 retries
        let retries = 3;
        while (retries > 0) {
          try {
            // Clean up any previous instrumenter
            if (inspectorInstrumenter) {
              inspectorInstrumenter.dispose();
              inspectorInstrumenter = null;
            }

            // Wait a moment between retries
            if (retries < 3) {
              outputChannel.appendLine(`\n[NextFlow] Waiting before retry...`);
              await new Promise((res) => setTimeout(res, 2000));
            }

            outputChannel.appendLine(
              `\n[NextFlow] Attempting to connect (${retries} retries left)`
            );
            inspectorInstrumenter = new InspectorInstrumenter();

            // Attach to the discovered port
            await inspectorInstrumenter.attachToDevServer(serverInfo.port);
            outputChannel.appendLine(
              "[NextFlow] Successfully connected inspector"
            );
            break;
          } catch (err) {
            retries--;
            if (retries === 0) {
              throw err;
            }
            outputChannel.appendLine(
              `\n[NextFlow] Connection attempt failed, retrying in 2 seconds...`
            );
            await new Promise((res) => setTimeout(res, 2000));
          }
        }

        // Create a webview panel for visualization, if desired
        const panel = vscode.window.createWebviewPanel(
          "nextFlow",
          "NextFlow",
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        const scriptUri = panel.webview.asWebviewUri(
          vscode.Uri.file(
            path.join(context.extensionPath, "dist", "webview.js")
          )
        );

        panel.webview.html = getWebviewContent(scriptUri);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case "pickFile":
              const options = {
                canSelectMany: false,
                openLabel: "Select Middleware",
                filters: {
                  TypeScript: ["ts"],
                  JavaScript: ["js"],
                },
              };
              const fileUri = await vscode.window.showOpenDialog(options);
              if (fileUri && fileUri[0]) {
                const filePath = fileUri[0].fsPath;
                try {
                  // Analyze the middleware file
                  const flare = await parsingScript(filePath);

                  // If you want to set breakpoints or instrumentation based on parse results:
                  if (inspectorInstrumenter && flare) {
                    const functionInfos = extractFunctionInfos(flare);
                    if (functionInfos) {
                      await inspectorInstrumenter.instrumentFunctions(
                        functionInfos
                      );
                    }
                  }

                  // Send data back to webview
                  panel.webview.postMessage({
                    command: "filePicked",
                    flare,
                    filePath,
                    baseDir: path.dirname(filePath),
                    compName: path.parse(filePath).base,
                  });
                } catch (err: unknown) {
                  const error =
                    err instanceof Error
                      ? err.message
                      : "An unknown error occurred";
                  console.error("Error in pickFile handling:", error);
                  vscode.window.showErrorMessage(
                    `Error processing middleware file: ${error}`
                  );
                }
              }
              break;

            case "openMetricsPanel":
              // If the user wants to open a metrics panel, we might open a new panel or reuse an existing one
              openMetricsPanel(context);
              break;
          }
        });

        vscode.window.showInformationMessage(
          "Monitored Dev Server started! Please select your middleware file."
        );
      } catch (err: unknown) {
        const error =
          err instanceof Error ? err.message : "An unknown error occurred";
        outputChannel.appendLine(`Error starting dev server: ${error}`);
        vscode.window.showErrorMessage(`Failed to start dev server: ${error}`);

        // Cleanup on error
        if (devServerProcess) {
          devServerProcess.kill();
          devServerProcess = null;
        }
        if (inspectorInstrumenter) {
          inspectorInstrumenter.dispose();
          inspectorInstrumenter = null;
        }
      }
    }
  );

  context.subscriptions.push(startMonitoredDevCommand);
}

/**
 * Provide basic HTML for your main webview
 */
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

/**
 * Simple example of opening a metrics panel
 */
function openMetricsPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "nextFlowMetrics",
    "NextFlow Metrics",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );
  panel.webview.html = getMetricsHtml();
}

/**
 * Provide basic HTML for metrics panel
 */
function getMetricsHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NextFlow Metrics</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; }
    h1 { background: #3C3C3C; color: #fff; padding: 10px; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin: 0; padding: 0; }
    th, td { text-align: left; padding: 8px; border: 1px solid #ccc; }
    th { background: #f4f4f4; }
    #metrics-container { padding: 10px; }
  </style>
</head>
<body>
  <h1>NextFlow Metrics</h1>
  <div id="metrics-container">Loading metrics...</div>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.command) {
        case 'runtimeMetrics':
          renderMetrics(message.data);
          break;
      }
    });

    function renderMetrics(invocations) {
      const container = document.getElementById('metrics-container');
      if (!invocations || !invocations.length) {
        container.innerHTML = '<p>No invocations recorded yet.</p>';
        return;
      }
      let rows = '';
      for (const inv of invocations) {
        rows += \`
          <tr>
            <td>\${inv.functionName}</td>
            <td>\${JSON.stringify(inv.arguments)}</td>
            <td>\${inv.error ? inv.error.message : JSON.stringify(inv.returnValue)}</td>
            <td>\${inv.cpuUsage ? JSON.stringify(inv.cpuUsage) : '-'}</td>
            <td>\${inv.memoryUsage ? JSON.stringify(inv.memoryUsage) : '-'}</td>
            <td>\${inv.timestamp}</td>
          </tr>\`;
      }
      container.innerHTML = \`
        <table>
          <thead>
            <tr>
              <th>Middleware</th>
              <th>Arguments</th>
              <th>Output/Error</th>
              <th>CPU Usage</th>
              <th>Memory Usage</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            \${rows}
          </tbody>
        </table>\`;
    }
  </script>
</body>
</html>
`;
}

// Clean up on deactivate
export function deactivate() {
  if (devServerProcess) {
    devServerProcess.kill();
  }
  inspectorInstrumenter?.dispose();
}

/**
 * Type for picking a dev command
 */
interface DevCommand {
  bin: string;
  args: string[];
  cwd: string;
}

/**
 * Example of a minimal dev command detection or fallback
 */
async function detectOrAskDevCommand(): Promise<DevCommand | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return null;
  const cwd = workspaceFolders[0].uri.fsPath;

  return {
    bin: "npm",
    args: ["run", "dev"],
    cwd,
  };
}

/**
 * Walk the parse tree for function info to pass to `instrumentFunctions`
 */
function extractFunctionInfos(analysis: FinalObject | undefined):
  | Array<{
      fnName: string;
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    }>
  | undefined {
  if (!analysis) {
    return undefined;
  }

  const functionInfos: Array<{
    fnName: string;
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  }> = [];

  function walkTree(node: FinalObject) {
    if (node.type === "function") {
      functionInfos.push({
        fnName: node.name,
        filePath: "", // If you know the original path, fill it in
        lineNumber: 1, // Placeholder
        columnNumber: 1, // Placeholder
      });
    }
    if (node.children) {
      node.children.forEach((child) => {
        walkTree(child);
      });
    }
  }

  walkTree(analysis);
  return functionInfos;
}