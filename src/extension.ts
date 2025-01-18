// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import t from '@babel/types';
// import * as os from 'os';
import { cpuUsage } from 'node:process';

// import parsingScript from './webview/parsingScript';

interface FileObject {
  file: string;
  name: string;
  path: Set<string>;
  matcher: Set<string>;
}

const parsingScript = async (filePath: string): Promise<any> => {
  
  const finalObjectCreator = (
    arrayOfFinalExports: FileObject[],
    finalObject: any = {}
  ): any => {
    // given the array, iterate through each object, this will be a new node everytime\
    const rootMiddlewareFilePath = arrayOfFinalExports[0].file;
    let rootCutPath = path.parse(rootMiddlewareFilePath).base;
    arrayOfFinalExports.forEach((object) => {
      //  objects will have this format ex:  {
      //   name: 'middleware',
      //   `file: '/home/anoyola/NextFlow-test-app/large-testapp/src/app/middlewares/mainMiddleware.ts'`,
      //   path: Set(0) {},
      //   matcher: Set(2) { '/protected/', '/login' }
      // },
      // lets cut the file path and include only the last two /s
      // let cutPath = getLastTwoSegments(object.file);
      let cutPath = path.parse(object.file).base;
      console.log('cutPath: ', cutPath);

      // if finalObject is empty then the first iteration is the intial one and this is the root path
      if (Object.keys(finalObject).length === 0 && cutPath === rootCutPath) {
        finalObject.name = rootCutPath;
        finalObject.children = [];
        finalObject.type = 'file';
        finalObject.matcher = [...object.matcher];
      }

      // we now have { name: rootPath, children: [], type: 'file', matcher:[] }

      //// need to have some form of check where it will not add another file inside of the children array if the current truncated file is equal to the rootCutPath (AKA the root file shouldnt be a child of itself)
      if (cutPath !== rootCutPath) {
        //this means the current file does not equal the root file, so it can be added to finalObject.children if it does not already contain an instance of this file
        if (
          !finalObject.children.some(
            (childObject: any) => childObject.name === cutPath
          )
        ) {
          // current file does not equal the root file and finalObject.children does not already contain an instance of this file
          // now lets add to finalObject.children to our file name
          finalObject.children.push({
            name: cutPath,
            children: [],
            type: 'file',
            matcher: [...object.matcher],
          });
        }
        // now we need to select out current file
        const selectedChildFileObject = finalObject.children.find(
          (childObject: any) => childObject.name === cutPath
        );
        // need to check if this file has the current middleware file already in the children array (shouldnt but doesnt hurt to check)
        if (
          !selectedChildFileObject.children.some(
            (childObject: any) => childObject.name === object.name
          )
        ) {
          // now we need to add our middleware function
          selectedChildFileObject.children.push({
            name: object.name,
            children: [],
            type: 'function',
          });
        }
        // now we need to select our current middle ware function
        const selectedChildFunctionObject =
          selectedChildFileObject.children.find(
            (childObject: any) => childObject.name === object.name
          );
        // need to check if this function has the current paths already in the children array;
        // since paths are unique to functions, simply check if the function's child array is empty?
        if (selectedChildFunctionObject) {
          object.path.forEach((path) => {
            if (
              !selectedChildFunctionObject.children.some(
                (childObject: any) => childObject.name === path
              )
            ) {
              selectedChildFunctionObject.children.push({
                name: path,
                type: 'path',
              });
            }
          });
        }
      }
      // our current file = our root file, this means we will not be adding a file and can skip to the functions instea
      if (cutPath === rootCutPath) {
        // check if finalObject.children (AKA our current object) array contains our current middleware function already
        if (
          !finalObject.children.some(
            (childObject: any) => childObject.name === object.name
          )
        ) {
          // if not add the current middle ware function
          finalObject.children.push({
            name: object.name,
            children: [],
            type: 'function',
          });
        }
        // select our current function
        const selectedChildFunctionObject = finalObject.children.find(
          (childObject: any) => childObject.name === object.name
        );
        // check if this functions children array is empty
        if (selectedChildFunctionObject) {
          object.path.forEach((path) => {
            if (
              !selectedChildFunctionObject.children.some(
                (childObject: any) => childObject.name === path
              )
            ) {
              selectedChildFunctionObject.children.push({
                name: path,
                type: 'path',
              });
            }
          });
        }
      }
    });
    console.log('finalObject :>> ', finalObject);
    return finalObject;
  };

  const pairMatcherWithFile = async (fileObject: FileObject): Promise<void> => {
    try {
      if (!fileObject.matcher) {
        fileObject.matcher = new Set();
      }
      // console.log('fileObject in matcher :>> ', fileObject);
      const dynamicMatcherRegex = /matcher:\s*\[\s*['"](.+?)['"]\s*\]/;

      const readStream = fs.createReadStream(fileObject.file);
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line: string) => {
        const cleanLine = line.trim();

        // If the line contains the word 'matcher' or any relevant keyword, apply regex matching
        if (cleanLine.includes('matcher')) {
          // Extract paths from the line using regex
          const matches = cleanLine.match(dynamicMatcherRegex);

          // If matches are found, add them to fileObject.matcher
          if (matches) {
            matches.forEach((match) => {
              // Normalize the match
              const normalizedMatch = match
                .replace(/^matcher:\s*\[/, "") // Remove "matcher: [" prefix
                .replace(/\]$/, "") // Remove the closing "]"
                .replace(/^['"]|['"]$/g, "") // Remove leading/trailing quotes
                .trim(); // Remove extra spaces
          
              // Add the normalized match to the matcher set
              fileObject.matcher.add(`'${normalizedMatch}'`);
          
              console.log('Added to matcher:', `'${normalizedMatch}'`);
            });
          }
        }
      });

      rl.on('close', () => {
        // console.log('Final fileObject matchers:', Array.from(fileObject.matcher));
      });
    } catch (error) {
      // console.log('Error encountered:', error);
    }
  };

  const pairPathWithMiddleware = async (
    fileObject: FileObject
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!fileObject.path) {
        fileObject.path = new Set();
      }
      const readStream = fs.createReadStream(fileObject.file);
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
      });
      let inFunction = false;

      rl.on('line', (line: string) => {
        const cleanLine = line.trim();
        // console.log('clean line :>> ', cleanLine);
        // Create a regex pattern to look for 'export function' followed by fileObject.name
        // const regex = new RegExp(
        //   `\\bexport\\s+function\\s+${fileObject.name}\\b`
        // );

        const regex = new RegExp(
          `\\bexport\\b(?:\\s+\\w+)*\\s+function\\s+${fileObject.name}\\b`
        );

        const secondRegex = new RegExp(`\\bexport\\b`);

        // Check if the line matches the pattern

        if (secondRegex.test(cleanLine) && inFunction) {
          // We found another 'export function', so toggle off inFunction
          inFunction = false;
          // console.log(
          //   'Exited function due to another export function:',
          //   cleanLine
          // );
        }

        if (regex.test(cleanLine)) {
          // console.log('regex test to enter fucntion passes:>> ');
          if (!inFunction) {
            // We're entering a new function
            inFunction = true;
            // console.log('Entered function:', cleanLine);
          }
        }

        if (inFunction) {
          const noCommentsText = cleanLine
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

          if (
            noCommentsText.trim().startsWith('import') ||
            noCommentsText.trim().startsWith('require')
          ) {
            return; // Skip this line
          }

          const pathRegex = /(?:\/[^\s,`']+|\b\w*\/\w*\b)/;

          const matches = noCommentsText.match(pathRegex);

          if (matches) {
            // console.log('matches :>> ', matches);
            const invalidPatterns = [
              'application/json',
              'text/html',
              'text/css',
              'application/xml', // Example unwanted patterns
              'charset=',
              'Content-Type',
              'Authorization', // More patterns to avoid
            ];
            const validPaths = matches.filter((path) => {
              // Check if any invalid pattern is part of the path
              return !invalidPatterns.some((pattern) => path.includes(pattern));
            });

            // Add valid paths to fileObject.path
            validPaths.forEach((match) => {
              fileObject.path.add(match);
              // console.log('fileObject after match :>> ', fileObject);
            });
          }
        }
      });

      rl.on('close', () => {
        // console.log('Final fileObject paths:', Array.from(fileObject.path));
        resolve(); // Resolve the promise after processing is done
      });

      rl.on('error', (error: Error) => {
        reject(error); // Reject the promise if there's an error
      });
    });
  };

  const analyzeMiddleware = async (
    filePath: string,
    finalExports: FileObject[] = []
  ): Promise<any> => {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      const imports: any[] = [];
      const exports: any[] = [];

      traverse(ast, {
        ImportDeclaration(path: any) {
          const importData = {
            source: path.node.source.value,
            specifiers: path.node.specifiers.map((spec: any) => ({
              imported: spec.imported ? spec.imported.name : 'default',
              local: spec.local.name,
            })),
          };
          imports.push(importData);
        },
        ExportNamedDeclaration(path: any) {
          if (path.node.declaration) {
            const declaration = path.node.declaration;
            if (declaration.declarations) {
              declaration.declarations.forEach((decl: any) => {
                exports.push({
                  name: decl.id.name,
                  file: filePath,
                });
              });
            } else if (declaration.id) {
              exports.push({
                name: declaration.id.name,
                file: filePath,
              });
            }
          } else if (path.node.specifiers) {
            path.node.specifiers.forEach((spec: any) => {
              exports.push({
                name: spec.exported.name,
                file: filePath,
              });
            });
          }
        },
        ExportDefaultDeclaration(path: any) {
          const declaration = path.node.declaration;
          if (
            declaration &&
            (declaration.type === 'FunctionDeclaration' ||
              declaration.type === 'ArrowFunctionExpression' ||
              declaration.type === 'FunctionExpression') &&
            declaration.id
          ) {
            exports.push({
              name: declaration.id.name,
              file: filePath,
            });
          }
        },
      });

      finalExports.push(...exports);
      console.log('exports :>> ', exports);
      console.log('finalExports:', finalExports);

      // Recursively analyze imports
      for (const importItem of imports) {
        if (importItem.source.includes('.')) {
          const absolutePath = path.join(
            path.dirname(filePath),
            `${importItem.source.replace('./', '')}.ts`
          );
          // console.log('absolutePath:', absolutePath);

          await analyzeMiddleware(absolutePath, finalExports); // Await recursive call
        }
      }

      // Ensure paths are updated for each file

      const filteredExports = finalExports.filter(
        (file: FileObject) => file.name !== 'config'
      );

      // console.log(
      //   'filteredExports before pair functions :>> ',
      //   filteredExports
      // );

      for (const file of filteredExports) {
        await pairPathWithMiddleware(file); // Await pairPathWithMiddleware for each file
        // console.log('filteredExports after pairing with middleware:>> ', filteredExports);
        await pairMatcherWithFile(file);
        // console.log('filteredExports inside pairing with matcher :>> ', filteredExports);
      }

      // console.log('filteredExports after pair functions :>> ', filteredExports);
      return filteredExports;
    } catch (error) {
      console.log(error);
    }
  };

  // Start traversing from the given file path
  // const filePathSmall = path.join(__dirname, '../testapp/src/app/middleware.ts');
  // console.log(analyzeMiddleware(filePathSmall));
  // const filePath = path.join(
  //   __dirname,
  //   '../large-testapp/src/app/middlewares/mainMiddleware.ts'
  // );
  const filteredExports = await analyzeMiddleware(filePath);
  return finalObjectCreator(filteredExports);
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "nextFlow" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const d3 = vscode.commands.registerCommand('nextFlow.start', async () => {
    const panel = vscode.window.createWebviewPanel(
      'nextFlow',
      'NextFlow',
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
          // console.log(message.text);
          const fileUri = await vscode.window.showOpenDialog(options);
          // console.log('fileUri: ', fileUri);
          if (fileUri && fileUri[0]) {
            const filePath = fileUri[0].fsPath;
            // console.log('filePath in extension.ts: ', filePath);
            try {
              const startCpu = process.cpuUsage();
              const startMemory = process.memoryUsage();
              console.log('start', startCpu, startMemory);

              const flare = await parsingScript(filePath);

              const endCpu = process.cpuUsage(startCpu);
              const endMemory = process.memoryUsage();
              console.log(
                'Difference time from start to end',
                endCpu,
                endMemory
              );

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

              // console.log('Performance metrics:', metrics);
              //   const flare = {
              //     name: "mainMiddleware.ts",
              //     children: [{
              //         name: "middleware"
              //     }, {
              //         name: "helloWorld"
              //     }, {
              //         name: "authMiddleware",
              //         children: [{
              //             name: "/protected"
              //         }, {
              //             name: "/login"
              //         }]
              //     }, {
              //         name: "localeMiddleware"
              //     }, {
              //         name: "customHeadersMiddleware"
              //     }]
              // };
              // const flare = {"name":"mainMiddleware.ts","children":[{"name":"middleware"},{"name":"helloWorld"},{"name":"authMiddleware","children":[{"name":"/protected"},{"name":"/login"}]},{"name":"localeMiddleware"},{"name":"customHeadersMiddleware"}]}

              // const flare = {
              //   name: "app",
              //   children: [
              //     {
              //       name: "/home",
              //       children: [{ name: "/about",
              //         children:[{ name: ":path*", children: [{name: ":/a"}, {name: ":/b"}, {name: ":/c"}] }]
              //         },
              //     { name: "/order", children: [{ name: '/order/:id', children: [{ name: ':item'}]}, { name: ':item' }]}]
              //     },
              //     { name: "/dashboard",
              //       children:[{ name: "/dashboard/user", children: [{name: "/dashboard/user/settings"}, {name: "/dashboard/user/config"}] }]
              //       }
              //   ],
              // };
              console.log('flare in extension.ts: ', flare);
              const baseDir = path.dirname(filePath);
              // console.log('baseDir: ', baseDir);
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
          // if (metricsData) {

          // }
          const metricsPanel = vscode.window.createWebviewPanel(
            'metrics',
            'NextFlow Metrics',
            vscode.ViewColumn.Two,
            {
              enableScripts: true,
              retainContextWhenHidden: true,
            }
          );

          metricsPanel.webview.html = `
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
                <h1>NextFlow Metrics</h1>
                
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

          metricsPanel.webview.postMessage({
            command: 'openMetricsPanel',
            metrics: metricsData,
          });
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

// function openMetricsPanel() {
//   const metricsPanel = vscode.window.createWebviewPanel(
//     'metrics',
//     'NextFlow Metrics',
//     vscode.ViewColumn.Two,
//     {
//       enableScripts: true,
//       retainContextWhenHidden: true,
//     }
//   );

// metricsPanel.webview.html = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Metrics</title>
//   <style>
//     body {
//       font-family: Arial, sans-serif;
//       padding: 16px;
//       color: var(--vscode-foreground);
//       background-color: var(--vscode-editor-background);
//     }
//     .metrics-container {
//       display: flex;
//       flex-direction: column;
//       gap: 12px;
//     }
//     .metric-section {
//       background: var(--vscode-editor-background);
//       border: 1px solid var(--vscode-panel-border);
//       border-radius: 4px;
//       padding: 12px;
//       margin-bottom: 16px;
//     }
//     .metric-section h2 {
//       margin: 0 0 12px 0;
//       font-size: 1.2em;
//       color: var(--vscode-foreground);
//     }
//     .metric {
//       display: flex;
//       justify-content: space-between;
//       font-size: 14px;
//       padding: 8px 0;
//       border-bottom: 1px solid var(--vscode-panel-border);
//     }
//     .metric:last-child {
//       border-bottom: none;
//     }
//     .value {
//       font-family: monospace;
//       color: var(--vscode-textLink-foreground);
//     }
//   </style>
// </head>
// <body>
//   <div class="metrics-container">
//     <h1>NextFlow Metrics</h1>

//     <div class="metric-section">
//       <h2>CPU Usage</h2>
//       <div class="metric">
//         <span>User Time:</span>
//         <span id="cpu-user" class="value">Loading...</span>
//       </div>
//       <div class="metric">
//         <span>System Time:</span>
//         <span id="cpu-system" class="value">Loading...</span>
//       </div>
//       <div class="metric">
//         <span>Total CPU Time:</span>
//         <span id="cpu-total" class="value">Loading...</span>
//       </div>
//     </div>

//     <div class="metric-section">
//       <h2>Memory Usage</h2>
//       <div class="metric">
//         <span>Heap Used:</span>
//         <span id="memory-heap-used" class="value">Loading...</span>
//       </div>
//       <div class="metric">
//         <span>Heap Total:</span>
//         <span id="memory-heap-total" class="value">Loading...</span>
//       </div>
//       <div class="metric">
//         <span>RSS:</span>
//         <span id="memory-rss" class="value">Loading...</span>
//       </div>
//       <div class="metric">
//         <span>External:</span>
//         <span id="memory-external" class="value">Loading...</span>
//       </div>
//     </div>
//   </div>

//   <script>
//     window.addEventListener('message', (event) => {
//       const message = event.data;

//       if (message.command === 'openMetricsPanel') {
//         // Update CPU metrics
//         if (message.metrics && message.metrics.cpu) {
//           document.getElementById('cpu-user').textContent = message.metrics.cpu.user;
//           document.getElementById('cpu-system').textContent = message.metrics.cpu.system;
//           document.getElementById('cpu-total').textContent = message.metrics.cpu.total;
//         }

//         // Update Memory metrics
//         if (message.metrics && message.metrics.memory) {
//           document.getElementById('memory-heap-used').textContent = message.metrics.memory.heapUsed;
//           document.getElementById('memory-heap-total').textContent = message.metrics.memory.heapTotal;
//           document.getElementById('memory-rss').textContent = message.metrics.memory.rss;
//           document.getElementById('memory-external').textContent = message.metrics.memory.external;
//         }
//       }
//     });
//   </script>
// </body>
// </html>
// `;
// }

// This method is called when your extension is deactivated
export function deactivate() {}
