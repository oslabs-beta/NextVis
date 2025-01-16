// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import t from '@babel/types';
// import parsingScript from './webview/parsingScript';

interface FileObject {
  file: string;
  name: string;
  path: Set<string>;
  matcher: Set<string>;
}

const parsingScript = async (filePath: string): Promise<any> => {
  const getLastTwoSegments = (filePath: string) => {
    const parts = filePath.split('/');
    // Get the last two parts
    return parts.slice(-2).join('/');
  };

  const finalObjectCreator = (
    arrayOfFinalExports: FileObject[],
    finalObject: any = {}
  ): any => {
    // given the array, iterate through each object, this will be a new node everytime\
    console.log('arrayOfFinalExports :>> ', arrayOfFinalExports);
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
      // and then store the path into the final object under the key 'name' and add a children array to it
      console.log('finalObject in object creator:>> ', finalObject);
      if (!finalObject.name) {
        finalObject.name = cutPath;
        finalObject.children = [];
      }
      console.log('finalObject before matcher :>> ', finalObject);
      if (!finalObject.matcher) {
        finalObject.matcher = [...object.matcher];
      }
      console.log('finalObject after matcher:>> ', finalObject);
      // now lets look at the name key(aka the actual middleware function within the file) in our orignal object and add that to its children array.
      console.log('finalObject before adding children:>> ', finalObject);
      if (
        !finalObject.children.some((child: any) => child.name === object.name)
      ) {
        finalObject.children.push({ name: object.name, children: [] });
      }
      console.log('finalObject after adding children:>> ', finalObject);
      // we'll add that to the children array with the same name:ex, children:[];, format
      // if the object has valid paths, we'll add that to the children array of the middle ware function, in this case middleware
      if (object.path.size !== 0) {
        const child = finalObject.children.find(
          (child: any) => child.name === object.name
        );
        if (child) {
          object.path.forEach((path) => {
            child.children.push({ name: path });
          });
          console.log('child.children :>> ', child.children);
        }
      }
      // we'll add the matcher as a seperate key that can be ignored for now
      if (object.matcher.size !== 0) {
    
        const child = finalObject.children.find(
          (child: any) => child.name === JSON.stringify({ cutPath })
        );
        console.log('child before match:>> ', child);
        if (child) {
          child.matcher = [...object.matcher];
          console.log('child.matcher :>> ', child.matcher);
        }
      }
      
      const finalChildrenArray = finalObject.children.find(
        (child: any) => child.name === object.name
      );
      // console.log('finalChildrenArray :>> ', finalChildrenArray);
      if (
        finalChildrenArray.children &&
        finalChildrenArray.children.length === 0
      ) {
        delete finalChildrenArray.children;
      }
    });
    // console.log('finalObject :>> ', finalObject);
    return finalObject;
  };

  const pairMatcherWithFile = async (fileObject: FileObject): Promise<void> => {
    try {
      if (!fileObject.matcher) {
        fileObject.matcher = new Set();
      }
      // console.log('fileObject in matcher :>> ', fileObject);
      const dynamicMatcherRegex = /\/[a-zA-Z0-9-_\/]+/g;

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
              fileObject.matcher.add(match);
              // console.log('Added to matcher:', match);
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

  const pairPathWithMiddleware = (fileObject: FileObject): Promise<void> => {
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
      const rootMiddlewareFilePath = filePath;
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
              const flare = await parsingScript(filePath);
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
          openMetricsPanel();
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

function openMetricsPanel() {
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
      <html>
      <head><title>Metrics</title></head>
      <body>
        <h1>NextFlow Metrics</h1>
      </body>
      </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
