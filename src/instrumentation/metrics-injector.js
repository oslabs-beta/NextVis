const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

class MetricsSetup {
  constructor(finalObjectFromParsingScript, projectRoot, extensionPath) {
    this.finalObject = finalObjectFromParsingScript;
    this.projectRoot = projectRoot;
    this.extensionPath = extensionPath;
    this.modifiedFiles = []; // Add tracking for modified files

    this.removeExistingInstrumentation(); // Cleanup before injecting new code

    this.functions = this.getOnlyFunctionsFromFinalObject();
    this.files = this.getOnlyFilesFromFinalObject();
    this.injectPerformanceTrackingCodeIntoUserCodebase();
    this.injectPerformanceTrackingFunctionCallsIntoUserCodebase();

    // Save list of modified files for cleanup
    this.saveModifiedFilesList();
  }

  getOnlyFunctionsFromFinalObject() {
    const functionNodes = [];

    function extractFunctions(node) {
      if (node.type === "function") {
        functionNodes.push(node);
      }
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => extractFunctions(child));
      }
    }
    extractFunctions(this.finalObject);

    return functionNodes;
  }

  getOnlyFilesFromFinalObject() {
    const fileNodes = [];

    function extractFiles(node) {
      if (node.type === "file") {
        fileNodes.push(node);
      }
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => extractFiles(child));
      }
    }

    extractFiles(this.finalObject);

    return fileNodes;
  }
  removeExistingInstrumentation() {
    const instrumentationDir = path.join(this.projectRoot, "nextvis");

    // Clean up any previously modified files
    this.restoreModifiedFiles();

    if (fs.existsSync(instrumentationDir)) {
      fs.rmSync(instrumentationDir, { recursive: true, force: true });
      console.log("[NextVis] Cleaned up existing instrumentation.");
    }
  }

  injectPerformanceTrackingCodeIntoUserCodebase() {
    const instrumentationDir = path.join(this.projectRoot, "nextvis");
    if (!fs.existsSync(instrumentationDir)) {
      fs.mkdirSync(instrumentationDir, { recursive: true });
    }

    // We only need the instrumentation code, no server
    const instrumentationCode = `
export function nextvisMetricsTracker(functionName, phase, args, executionId = null) {
    const sendMetrics = (data) => {
        fetch("http://localhost:3099/metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }).catch(err => console.error("[NextVis] Failed to send metrics:", err));
    };

    // Use high-resolution timestamps for more precise measurements
    const timestamp = performance.now();
    const req = Array.from(args || []).find(arg => arg?.url || arg?.method) || {};
    
    // Generate a unique execution ID only for start events, or use provided ID for completion
    const id = phase === "start" 
        ? Date.now() + Math.random().toString(36).substring(2, 9) 
        : executionId;

    sendMetrics({
        type: phase === "start" ? "functionStart" : "functionComplete",
        functionName,
        timestamp,
        url: req.url || "",
        method: req.method || "",
        executionId: id
    });

    // Return the ID so it can be used to match start with completion
    return id;
}
        `;

    fs.writeFileSync(
      path.join(instrumentationDir, "metrics-collector.js"),
      instrumentationCode
    );
  }

  injectPerformanceTrackingFunctionCallsIntoUserCodebase() {
    this.files.forEach((file) => {
      const filePath = file.filePath;
      if (!fs.existsSync(filePath)) return;

      let code = fs.readFileSync(filePath, "utf8");
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      let modified = false;
      let hasImport = false;

      traverse(ast, {
        ImportDeclaration(path) {
          if (path.node.source.value === "nextvis/metrics-collector") {
            hasImport = true;
          }
        },
      });

      if (!hasImport) {
        const importDeclaration = t.importDeclaration(
          [
            t.importSpecifier(
              t.identifier("nextvisMetricsTracker"),
              t.identifier("nextvisMetricsTracker")
            ),
          ],
          t.stringLiteral("@/../nextvis/metrics-collector")
        );
        ast.program.body.unshift(importDeclaration);
        modified = true;
      }

      traverse(ast, {
        FunctionDeclaration(path) {
          const functionName = path.node.id?.name || "anonymous";
          if (!functionName) return;

          // Create an array expression from the function's parameters
          const paramsArray = t.arrayExpression(
            path.node.params.map((param) =>
              t.identifier(
                param.name || (param.left && param.left.name) || "undefined"
              )
            )
          );

          // Create a variable declaration to store the execution ID from the start call
          const executionIdVar = t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier("_nextvisExecutionId"),
              t.callExpression(t.identifier("nextvisMetricsTracker"), [
                t.stringLiteral(functionName),
                t.stringLiteral("start"),
                paramsArray,
              ])
            ),
          ]);

          path.node.body.body.unshift(executionIdVar);

          path.traverse({
            ReturnStatement(returnPath) {
              returnPath.insertBefore(
                t.expressionStatement(
                  t.callExpression(t.identifier("nextvisMetricsTracker"), [
                    t.stringLiteral(functionName),
                    t.stringLiteral("complete"),
                    paramsArray,
                    t.identifier("_nextvisExecutionId"), // Pass the stored execution ID
                  ])
                )
              );
            },
          });

          modified = true;
        },
      });

      if (modified) {
        // Create backup before modifying
        this.backupFile(filePath);

        // Add to modified files list for later cleanup
        if (!this.modifiedFiles.includes(filePath)) {
          this.modifiedFiles.push(filePath);
        }

        fs.writeFileSync(filePath, generate(ast).code);
        console.log(`[NextVis] Instrumentation injected into ${filePath}`);
      }
    });
  }

  // Add new method to save original files before modification
  backupFile(filePath) {
    const backupDir = path.join(this.projectRoot, "nextvis", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, fileName + ".original");

    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }
  }

  // Add method to save list of modified files
  saveModifiedFilesList() {
    const instrumentationDir = path.join(this.projectRoot, "nextvis");
    if (!fs.existsSync(instrumentationDir)) {
      fs.mkdirSync(instrumentationDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(instrumentationDir, "modified-files.json"),
      JSON.stringify(this.modifiedFiles)
    );
  }

  // Add method to restore modified files
  restoreModifiedFiles() {
    const modifiedFilesPath = path.join(
      this.projectRoot,
      "nextvis",
      "modified-files.json"
    );
    const backupDir = path.join(this.projectRoot, "nextvis", "backups");

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
  }
}

module.exports = { MetricsSetup };
