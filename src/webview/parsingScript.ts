import * as path from "path";
import * as fs from "fs";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

interface FileObject {
  file: string;
  name: string;
  path?: Set<string>;
  matcher?: Set<string>;
}

export interface FinalObject {
  name: string;
  children: FinalObject[];
  type: "file" | "function" | "path";
  matcher?: string[];
}

interface ImportData {
  source: string;
  specifiers: {
    imported: string | "default";
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
  "application/json",
  "text/html",
  "text/css",
  "application/xml",
  "charset=",
  "Content-Type",
  "Authorization",
];

const parsingScript = async (
  filePath: string
): Promise<FinalObject | undefined> => {
  const finalObjectCreator = (
    arrayOfFinalExports: FileObject[],
    finalObject: FinalObject = { name: "", children: [], type: "file" }
  ): FinalObject => {
    const rootMiddlewareFilePath = arrayOfFinalExports[0].file;
    const rootCutPath = path.parse(rootMiddlewareFilePath).base;

    arrayOfFinalExports.forEach((object) => {
      let cutPath = path.parse(object.file).base;
      if (finalObject.name === "" && cutPath === rootCutPath) {
        finalObject.name = rootCutPath;
        finalObject.children = [];
        finalObject.type = "file";
        finalObject.matcher = object.matcher ? [...object.matcher] : [];
      }

      if (cutPath !== rootCutPath) {
        if (
          !finalObject.children.some(
            (childObject) => childObject.name === cutPath
          )
        ) {
          finalObject.children.push({
            name: cutPath,
            children: [],
            type: "file",
            matcher: object.matcher ? [...object.matcher] : [],
          });
        }
        const selectedChildFileObject = finalObject.children.find(
          (childObject) => childObject.name === cutPath
        );
        if (
          !selectedChildFileObject?.children.some(
            (childObject) => childObject.name === object.name
          )
        ) {
          selectedChildFileObject?.children.push({
            name: object.name,
            children: [],
            type: "function",
          });
        }
        const selectedChildFunctionObject =
          selectedChildFileObject?.children.find(
            (childObject) => childObject.name === object.name
          );
        if (selectedChildFunctionObject) {
          object.path?.forEach((p) => {
            if (
              !selectedChildFunctionObject.children.some(
                (childObject) => childObject.name === p
              )
            ) {
              selectedChildFunctionObject.children.push({
                name: p,
                children: [],
                type: "path",
              });
            }
          });
        }
      }

      if (cutPath === rootCutPath) {
        if (
          !finalObject.children.some(
            (childObject) => childObject.name === object.name
          )
        ) {
          finalObject.children.push({
            name: object.name,
            children: [],
            type: "function",
          });
        }
        const selectedChildFunctionObject = finalObject.children.find(
          (childObject) => childObject.name === object.name
        );
        if (selectedChildFunctionObject) {
          object.path?.forEach((p) => {
            if (
              !selectedChildFunctionObject.children.some(
                (childObject) => childObject.name === p
              )
            ) {
              selectedChildFunctionObject.children.push({
                name: p,
                children: [],
                type: "path",
              });
            }
          });
        }
      }
    });
    return finalObject;
  };

  const pairMatcherWithFile = async (fileObject: FileObject): Promise<void> => {
    const content = fs.readFileSync(fileObject.file, "utf8");
    const matches = content.match(dynamicMatcherRegex);
    if (matches) {
      matches.forEach((match) => {
        const normalizedMatch = match
          .replace(/^matcher:\s*\[/, "")
          .replace(/\]$/, "")
          .replace(/^['"]|['"]$/g, "")
          .trim();
        fileObject.matcher?.add(`'${normalizedMatch}'`);
      });
    }
  };

  const pairPathWithMiddleware = async (fileObject: FileObject): Promise<void> => {
    if (!fileObject.path) {
      fileObject.path = new Set();
    }
    if (!fileObject.matcher) {
      fileObject.matcher = new Set();
    }

    const content = fs.readFileSync(fileObject.file, "utf8");
    const lines = content.split("\n");
    let inFunction = false;

    lines.forEach((line) => {
      const cleanLine = line.trim();
      const functionRegex = new RegExp(
        `\\bexport\\b(?:\\s+\\w+)*\\s+function\\s+${fileObject.name}\\b`
      );
      const secondRegex = new RegExp(`\\bexport\\b`);

      if (secondRegex.test(cleanLine) && inFunction) {
        inFunction = false;
      }

      if (functionRegex.test(cleanLine)) {
        inFunction = true;
      }

      if (inFunction) {
        const noCommentsText = cleanLine
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        if (
          noCommentsText.trim().startsWith("import") ||
          noCommentsText.trim().startsWith("require")
        ) {
          return;
        }

        const matches = noCommentsText.match(pathRegex);
        if (matches) {
          const validPaths = matches.filter(
            (p) => !invalidPatterns.some((pattern) => p.includes(pattern))
          );
          validPaths.forEach((m) => fileObject.path?.add(m));
        }
      }
    });
  };

  const analyzeMiddleware = async (
    filePath: string,
    finalExports: FileObject[] = []
  ): Promise<FileObject[]> => {
    const code = fs.readFileSync(filePath, "utf8");
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });

    const imports: ImportData[] = [];
    const exports: ExportData[] = [];

    traverse(ast, {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map((spec) => ({
            imported:
              spec.type === "ImportSpecifier"
                ? t.isIdentifier(spec.imported)
                  ? spec.imported.name
                  : spec.imported.value
                : "default",
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
            name: "default",
            file: filePath,
          });
        }
      },
    });

    finalExports.push(...exports);

    await Promise.all(
      imports.map(async (importItem) => {
        // If the import is relative, dive deeper
        if (importItem.source.includes(".")) {
          const absolutePath = path.join(
            path.dirname(filePath),
            `${importItem.source.replace("./", "")}.ts`
          );
          if (fs.existsSync(absolutePath)) {
            await analyzeMiddleware(absolutePath, finalExports);
          }
        }
      })
    );

    // Filter out any "config" exports or other non-middleware
    const filteredExports = finalExports.filter(
      (file) => file.name !== "config"
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
  return finalObjectCreator(filteredExports);
};

export default parsingScript;