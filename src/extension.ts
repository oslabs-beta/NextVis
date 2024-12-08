// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "nextFlow" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
  const d3 = vscode.commands.registerCommand('nextFlow.start', () => {
    const panel = vscode.window.createWebviewPanel(
      'nextFlow',
      'NextFlow',
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "dist", "webview.js"))
    );

    panel.webview.html = getWebviewContent(scriptUri);
  });

	context.subscriptions.push(d3);
}

function getWebviewContent(uri: any) {
  return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Middleware Dendrogram</title>
      </head>
      <body>
        <div id="chart"></div>
        <script src="${uri}"></script>
      </body>
      </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}