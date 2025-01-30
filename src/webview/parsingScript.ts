import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

interface FileObject {
  file: string;
  name: string;
  path?: Set<string>;
  matcher?: Set<string>;
}

interface FinalObject {
  name: string;
  children: FinalObject[];
  type: 'file' | 'function' | 'path';
  matcher?: string[];
}

interface ImportData {
  source: string;
  specifiers: {
    imported: string | 'default';
    local: string;
  }[];
}

interface ExportData {
  name: string;
  file: string;
  path?: Set<string>;
  matcher?: Set<string>;
}

const parsingScript = async (filePath: string): Promise<FinalObject | undefined> => {
  
  const finalObjectCreator = (
    arrayOfFinalExports: FileObject[],
    finalObject: FinalObject = {name: '', children: [], type: 'file'}
  ): FinalObject => {
    // given the array, iterate through each object, this will be a new node everytime\
    const rootMiddlewareFilePath = arrayOfFinalExports[0].file;
    let rootCutPath = path.parse(rootMiddlewareFilePath).base;
    arrayOfFinalExports.forEach((object) => {
      // lets cut the file path and include only the last two /s
      let cutPath = path.parse(object.file).base;
      // console.log('cutPath: ', cutPath);

      // if finalObject is empty then the first iteration is the intial one and this is the root path
      if (finalObject.name === '' && cutPath === rootCutPath) {
        finalObject.name = rootCutPath;
        finalObject.children = [];
        finalObject.type = 'file';
        finalObject.matcher = object.matcher ? [...object.matcher] : [];
      }

      // we now have { name: rootPath, children: [], type: 'file', matcher:[] }
      // need to have some form of check where it will not add another file inside of the children array if the current truncated file is equal to the rootCutPath (AKA the root file shouldnt be a child of itself)
      if (cutPath !== rootCutPath) {
        //this means the current file does not equal the root file, so it can be added to finalObject.children if it does not already contain an instance of this file
        if (!finalObject.children.some((childObject) => childObject.name === cutPath)) {
          // current file does not equal the root file and finalObject.children does not already contain an instance of this file
          // now lets add to finalObject.children to our file name
          finalObject.children.push({
            name: cutPath,
            children: [],
            type: 'file',
            matcher: object.matcher ? [...object.matcher] : [],
          });
        }
        // now we need to select out current file
        const selectedChildFileObject = finalObject.children.find((childObject) => childObject.name === cutPath);
        // need to check if this file has the current middleware file already in the children array (shouldnt but doesnt hurt to check)
        if (!selectedChildFileObject?.children.some((childObject) => childObject.name === object.name)) {
          // now we need to add our middleware function
          selectedChildFileObject?.children.push({
            name: object.name,
            children: [],
            type: 'function',
          });
        }
        // now we need to select our current middle ware function
        const selectedChildFunctionObject = selectedChildFileObject?.children.find((childObject) => childObject.name === object.name);
        // need to check if this function has the current paths already in the children array;
        // since paths are unique to functions, simply check if the function's child array is empty?
        if (selectedChildFunctionObject) {
          object.path?.forEach((path) => {
            if (!selectedChildFunctionObject.children.some((childObject) => childObject.name === path)) {
              selectedChildFunctionObject.children.push({
                name: path,
                children: [],
                type: 'path',
              });
            }
          });
        }
      }
      // our current file = our root file, this means we will not be adding a file and can skip to the functions instea
      if (cutPath === rootCutPath) {
        // check if finalObject.children (AKA our current object) array contains our current middleware function already
        if (!finalObject.children.some((childObject) => childObject.name === object.name)) {
          // if not add the current middle ware function
          finalObject.children.push({
            name: object.name,
            children: [],
            type: 'function',
          });
        }
        // select our current function
        const selectedChildFunctionObject = finalObject.children.find((childObject) => childObject.name === object.name);
        // check if this functions children array is empty
        if (selectedChildFunctionObject) {
          object.path?.forEach((path) => {
            if (!selectedChildFunctionObject.children.some((childObject) => childObject.name === path)) {
              selectedChildFunctionObject.children.push({
                name: path,
                children: [],
                type: 'path',
              });
            }
          });
        }
      }
    });
    return finalObject;
  };

  const pairMatcherWithFile = async (fileObject: FileObject): Promise<void> => {
    try {
      if (!fileObject.matcher) {
        fileObject.matcher = new Set();
      }
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
              fileObject.matcher?.add(`'${normalizedMatch}'`);
            });
          }
        }
      });

    } catch (error) {
      console.log('Error encountered:', error);
    }
  };

  const pairPathWithMiddleware = async (fileObject: FileObject): Promise<void> => {
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

        const regex = new RegExp(`\\bexport\\b(?:\\s+\\w+)*\\s+function\\s+${fileObject.name}\\b`);
        const secondRegex = new RegExp(`\\bexport\\b`);

        // Check if the line matches the pattern
        if (secondRegex.test(cleanLine) && inFunction) {
          // We found another 'export function', so toggle off inFunction
          inFunction = false;
        }

        if (regex.test(cleanLine)) {
          if (!inFunction) {
            // We're entering a new function
            inFunction = true;
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
              fileObject.path?.add(match);
            });
          }
        }
      });

      rl.on('close', () => {
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
  ): Promise<FileObject[]> => {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      const imports: ImportData[] = [];
      const exports: ExportData[] = [];

      traverse(ast, {
        ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
          const importData: ImportData = {
            source: path.node.source.value,
            
            specifiers: path.node.specifiers.map((spec) => ({
              imported: spec.type === "ImportSpecifier" ? (t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value) : 'default',
              local: spec.local.name,
            })),
          };
          imports.push(importData);
        },
        ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
          if (path.node.declaration) {
            const declaration = path.node.declaration;
            if (t.isVariableDeclaration(declaration)) {
              declaration.declarations.forEach((decl) => {
                if (t.isIdentifier(decl.id)){
                  exports.push({
                    name: decl.id.name,
                    file: filePath,
                  });
                }
              });
            } else if (t.isFunctionDeclaration(declaration) && declaration.id) {
              exports.push({
                name: declaration.id.name,
                file: filePath,
              });
            }
          } else if (path.node.specifiers) {
            path.node.specifiers.forEach((spec) => {
              if (t.isIdentifier(spec.exported)) {
                exports.push({
                  name: spec.exported.name,
                  file: filePath,
                });
              }
            });
          }
        },
        ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
          const declaration = path.node.declaration;
          if (
            (t.isFunctionDeclaration(declaration) && declaration.id) ||
            (t.isFunctionExpression(declaration) && declaration.id)
          ) {
            exports.push({
              name: declaration.id.name,
              file: filePath,
            });
          } else if (t.isArrowFunctionExpression(declaration)) {
            exports.push({
              name: 'default',
              file: filePath,
            });
          }
        },
      });

      finalExports.push(...exports);
      // console.log('exports: ', exports);
      // console.log('finalExports: ', finalExports);

      // Recursively analyze imports
      for (const importItem of imports) {
        if (importItem.source.includes('.')) {
          const absolutePath = path.join(
            path.dirname(filePath),
            `${importItem.source.replace('./', '')}.ts`
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

      return filteredExports;
    } catch (error) {
      console.log('Error analyzing middleware: ', error);
      return [];
    }
  };

  const filteredExports = await analyzeMiddleware(filePath);
  return finalObjectCreator(filteredExports);
};

export default parsingScript;