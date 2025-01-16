const fs = require('fs');
const path = require('path');
const readline = require('readline');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

interface FileObject {
  file: string,
  name: string,
  path: Set<string | null>,
  matcher: Set<string | null>
}

const parsingScript = (filePath: string) => {
    const getLastTwoSegments = (filePath: string) => {
      const parts = filePath.split('/');
      // Get the last two parts
      return parts.slice(-2).join('/');
    };
    
    const jsonCreator = (arrayOfFinalExports: FileObject[], finalObject: any = {}) => {
      // given the array, iterate through each object, this will be a new node everytime\
      arrayOfFinalExports.forEach(object  => {
        //  objects will have this format ex:  {
          //   name: 'middleware',
          //   file: '/home/anoyola/NextFlow-test-app/large-testapp/src/app/middlewares/mainMiddleware.ts',
          //   path: Set(0) {},
          //   matcher: Set(2) { '/protected/', '/login' }
          // },
        // lets cut the file path and include only the last two /s
        let cutPath = getLastTwoSegments(object.file);
        // console.log(cutPath);
        // and then store the path into the final object under the key 'name' and add a children array to it
        if(!finalObject.name) {
          finalObject.name = cutPath;
          finalObject.children = [];
        }
        // console.log('finalObject :>> ', finalObject);
        // now lets look at the name key in our orignal object and add that to its children array. 
        if (!finalObject.children.some((child: any) => child.name === object.name)) {
          finalObject.children.push({ name: object.name, children: [] });
        }
        // we'll add that to the children array with the same name:ex, children:[];, format
        // if the object has valid paths, we'll add that to the children array of the middle ware function, in this case middleware
        if (object.path.size !== 0) {
          const child = finalObject.children.find((child: any) => child.name === object.name);
          if (child) {
            child.children = [...object.path];
            // console.log('child.children :>> ', child.children);
          }
        }
        // console.log('finalObject :>> ', finalObject);
        // we'll add the matcher as a seperate key that can be ignored for now
        if (object.matcher.size !== 0) {
          const child = finalObject.children.find((child: any) => child.name === object.name);
          if (child) {
            child.matcher = [...object.matcher];
            // console.log('child.matcher :>> ', child.matcher);
          }
        }
      });
      // console.log('finalObject :>> ', finalObject);
      return JSON.stringify(finalObject);
    };
    
    const pairMatcherWithFile = async (fileObject: {file: string, name: string, path: Set<string | void>, matcher: Set<string | null> }) =>{
      try {
      if (!fileObject.matcher) {
        fileObject.matcher = new Set();
      }
    
      const dynamicMatcherRegex = /\/[a-zA-Z0-9-_\/]+/g; // Matches paths like '/protected/user/123'
    
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
      }
      catch (error) {
        // console.log('Error encountered:', error);
      }
    }
    
    const pairPathWithMiddleware = (fileObject: FileObject) => {
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
          // Create a regex pattern to look for 'export function' followed by fileObject.name
          const regex = new RegExp(
            `\\bexport\\s+function\\s+${fileObject.name}\\b`
          );
    
          const secondRegex = new RegExp(`\\bexport\\b`);
    
          // Check if the line matches the pattern
    
          if(secondRegex.test(cleanLine) && inFunction){
            // We found another 'export function', so toggle off inFunction
            inFunction = false;
            // console.log('Exited function due to another export function:', cleanLine);
          }
          
            if (regex.test(cleanLine)) {
              if (!inFunction) {
                // We're entering a new function
                inFunction = true;
                // console.log('Entered function:', cleanLine);
              }
            }
        
    
          if(inFunction){
            // console.log('cleanLine :>> ', cleanLine);
            const noCommentsText = cleanLine
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
            
            if (
              noCommentsText.trim().startsWith('import') ||
              noCommentsText.trim().startsWith('require')
            ) {
              return; // Skip this line
            }
            
            // console.log('No comments text:', noCommentsText);
    
            const pathRegex = /\/[a-zA-Z0-9-_\/\.?=&]+/g;
            const matches = noCommentsText.match(pathRegex);
    
            if (matches) {
              matches.forEach((match) => {
                fileObject.path.add(match);

              });
            }
    
      
          }
        });
    
        rl.on('close', () => {
          console.log('Final fileObject paths:', Array.from(fileObject.path));
          Promise.resolve(); // Resolve the promise after processing is done
        });
    
        rl.on('error', (error: Error) => {
          reject(error); // Reject the promise if there's an error
        });
      });
    };
    
    // const getPathNames = (filePath) => {
    //   const innerFileText = fs.readFileSync(filePath, 'utf8');
    
    //   // Remove single-line comments and multi-line comments
    //   const noCommentsText = innerFileText
    //     .replace(/\/\/.*$/gm, '') // Remove single-line comments
    //     .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    
    //   // Split the content into lines
    //   const lines = noCommentsText.split('\n');
    
    //   // Filter out lines that start with 'import' or 'require' (for imports)
    //   const filteredLines = lines.filter(line => !line.trim().startsWith('import') && !line.trim().startsWith('require'));
    
    //   // Define a regex to match paths starting with '/' but exclude those with 'import' or 'require'
    //   const pathRegex = /(?<!import\s+['"]|require\(['"])\/[a-zA-Z0-9-_\/]+/g;
    
    //   // Create a Set to store unique paths
    //   const uniquePaths = new Set();
    
    //   // Iterate through each line and find matches
    //   filteredLines.forEach(line => {
    //     const pathMatches = line.match(pathRegex);
    
    //     if (pathMatches) {
    //       pathMatches.forEach(path => {
    //         uniquePaths.add(path); // Store path directly in the Set
    //       });
    //     }
    //   });
    
    //   // Return the Set as an array
    //   return Array.from(uniquePaths);
    // };
    
    // const analyzeFilePaths = (finalExports) => {
    //   const checkedPaths = new Set();
    //   finalExports.forEach((file) => {
    //     if (file.name !== 'config') {
    //       checkedPaths.add(file);
    //     }
    //   });
    //   checkedPaths.forEach((path) => {
    //     // go inside file, create path array for it and if its name key is config, delete it
    //     // console.log('path being used :>> ', path);
    //     pairPathWithMiddleware(path);
    //     //  console.log('path :>> ', path);
    //   });
    // };
    
    const analyzeMiddleware = async (filePath: string, finalExports: any = []) => {
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
          ImportDeclaration(path :any) {
            const importData = {
              source: path.node.source.value,
              specifiers: path.node.specifiers.map((spec :any) => ({
                imported: spec.imported ? spec.imported.name : 'default',
                local: spec.local.name,
              })),
            };
            imports.push(importData);
          },
          ExportNamedDeclaration(path :any) {
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
            exports.push({
              name: 'default',
              file: filePath,
            });
          },
        });
    
        finalExports.push(...exports);
    
        // Recursively analyze imports
        for (const importItem of imports) {
          if (importItem.source.includes('.')) {
            const absolutePath = path.join(
              __dirname,
              `../large-testapp/src/app/middlewares/${importItem.source.replace(
                './',
                ''
              )}.ts`
            );
    
            await analyzeMiddleware(absolutePath, finalExports); // Await recursive call
          }
        }
    
        // Ensure paths are updated for each file
    
        const filteredExports = finalExports.filter(
          (file: FileObject) => file.name !== 'config'
        );
    
        for (const file of filteredExports) {
          await pairPathWithMiddleware(file); // Await pairPathWithMiddleware for each file
          await pairMatcherWithFile(file);
        }
    
        console.log('finalExports :>> in analyze', filteredExports);
        jsonCreator(filteredExports);
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
    analyzeMiddleware(filePath);
};

export default parsingScript;