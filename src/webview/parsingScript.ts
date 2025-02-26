import * as path from 'path';
import * as fs from 'fs';
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

const dynamicMatcherRegex = /matcher:\s*\[\s*['"](.+?)['"]\s*\]/;
const pathRegex = /(?:\/[^\s,`']+|\b\w*\/\w*\b)/;
const invalidPatterns = [
  'application/json',
  'text/html',
  'text/css',
  'application/xml',
  'charset=',
  'Content-Type',
  'Authorization',
];

const parsingScript = async (
  filePath: string
): Promise<FinalObject | undefined> => {
  const finalObjectCreator = (
    arrayOfFinalExports: FileObject[],
    finalObject: FinalObject = { name: '', children: [], type: 'file' }
  ): FinalObject => {

    if (arrayOfFinalExports.length === 1) {
      return { name: path.parse(filePath).base , children: [], type: 'file' };
    }

    // given the array, iterate through each object, this will be a new node everytime\
    const rootMiddlewareFilePath = arrayOfFinalExports[0].file;
    let rootCutPath = path.parse(rootMiddlewareFilePath).base;

    arrayOfFinalExports.forEach((object) => {
      // lets cut the file path and include only the last two /s
      let cutPath = path.parse(object.file).base;

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
        if (
          !finalObject.children.some(
            (childObject) => childObject.name === cutPath
          )
        ) {
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
        const selectedChildFileObject = finalObject.children.find(
          (childObject) => childObject.name === cutPath
        );
        // need to check if this file has the current middleware file already in the children array (shouldnt but doesnt hurt to check)
        if (
          !selectedChildFileObject?.children.some(
            (childObject) => childObject.name === object.name
          )
        ) {
          // now we need to add our middleware function
          selectedChildFileObject?.children.push({
            name: object.name,
            children: [],
            type: 'function',
          });
        }
        // now we need to select our current middle ware function
        const selectedChildFunctionObject =
          selectedChildFileObject?.children.find(
            (childObject) => childObject.name === object.name
          );
        // need to check if this function has the current paths already in the children array;
        // since paths are unique to functions, simply check if the function's child array is empty?
        if (selectedChildFunctionObject) {
          object.path?.forEach((path) => {
            if (
              !selectedChildFunctionObject.children.some(
                (childObject) => childObject.name === path
              )
            ) {
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
        if (
          !finalObject.children.some(
            (childObject) => childObject.name === object.name
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
          (childObject) => childObject.name === object.name
        );
        // check if this functions children array is empty
        if (selectedChildFunctionObject) {
          object.path?.forEach((path) => {
            if (
              !selectedChildFunctionObject.children.some(
                (childObject) => childObject.name === path
              )
            ) {
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
    const content = fs.readFileSync(fileObject.file, 'utf8');
      // If the line contains the word 'matcher' or any relevant keyword, apply regex matching
        // Extract paths from the line using regex
    const matches = content.match(dynamicMatcherRegex);
    // If matches are found, normalize them
    if (matches) {
      matches.forEach((match) => {
         // Normalize the match
        const normalizedMatch = match
          .replace(/^matcher:\s*\[/, "")
          .replace(/\]$/, "")
          .replace(/^['"]|['"]$/g, "")
          .trim();
           // Add the normalized match to the matcher set in file object
        fileObject.matcher?.add(`'${normalizedMatch}'`);
      });
    }
  };

  const pairPathWithMiddleware = async (fileObject: FileObject): Promise<void> => {
    // Initialize `path` and `matcher` if they are undefined
    if (!fileObject.path) {
      fileObject.path = new Set();
    }
    if (!fileObject.matcher) {
      fileObject.matcher = new Set();
    }
  
    // Read the file content
    const content = fs.readFileSync(fileObject.file, 'utf8');
    const lines = content.split('\n');
    let inFunction = false;
  
    // Process each line
    lines.forEach((line) => {
      const cleanLine = line.trim();
      const regex = new RegExp(`\\bexport\\b(?:\\s+\\w+)*\\s+function\\s+${fileObject.name}\\b`);
      const secondRegex = new RegExp(`\\bexport\\b`);
  
      // Check if we're exiting the function
      if (secondRegex.test(cleanLine) && inFunction) {
        inFunction = false;
      }
  
      // Check if we're entering the target function
      if (regex.test(cleanLine)) {
        inFunction = true;
      }
  
      // If we're inside the function, process the line
      if (inFunction) {
        // Remove comments from the line
        const noCommentsText = cleanLine
          .replace(/\/\/.*$/gm, '') // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
  
        // Skip lines that start with 'import' or 'require'
        if (noCommentsText.trim().startsWith('import') || noCommentsText.trim().startsWith('require')) {
          return;
        }
  
        // Extract paths using the pathRegex
        const matches = noCommentsText.match(pathRegex);
        if (matches) {
          // Filter out invalid paths
          const validPaths = matches.filter((path) => !invalidPatterns.some((pattern) => path.includes(pattern)));
          // Add valid paths to the fileObject.path Set
          validPaths.forEach((match) => fileObject.path?.add(match));
        }
      }
    });
  };

  const analyzeMiddleware = async (
    filePath: string,
    finalExports: FileObject[] = []
  ): Promise<FileObject[]> => {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const imports: ImportData[] = [];
    const exports: ExportData[] = [];

    traverse(ast, {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map((spec) => ({
            imported:
              spec.type === 'ImportSpecifier' ? (t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value) : 'default',
            local: spec.local.name,
          })),
        });
      },
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
        if (path.node.declaration) {
          const declaration = path.node.declaration;
          if (t.isVariableDeclaration(declaration)) {
            declaration.declarations.forEach((decl) => {
              if (t.isIdentifier(decl.id)) {
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

    await Promise.all(
      imports.map(async (importItem) => {
        if (importItem.source.includes('.')) {
          const absolutePath = path.join(
            path.dirname(filePath),
            `${importItem.source.replace('./', '')}.ts`
          );
          await analyzeMiddleware(absolutePath, finalExports);
        }
      })
    );

    // console.log('imports: ', imports);
    // console.log('exports: ', exports);

    const filteredExports = finalExports.filter(
      (file) => file.name !== 'config'
    );
    await Promise.all(
      filteredExports.map(async (file) => {
        await pairPathWithMiddleware(file);
        await pairMatcherWithFile(file);
      })
    );
    return filteredExports;
  };

  const filteredExports = await analyzeMiddleware(filePath);

  if (filteredExports.length === 0) {
    return finalObjectCreator([{ name: '', file: filePath }]);
  }
  return finalObjectCreator(filteredExports);
};

export default parsingScript;