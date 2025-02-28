const { spawn } = require("child_process");
const path = require("path");
const vscode = require("vscode");
const fs = require("fs");

class DevServer {
  constructor(devServerCommand, projectRoot) {
    this.devServerCommand = devServerCommand;
    this.projectRoot = projectRoot;
    this.serverProcess = null;
  }

  startDevServer() {
    return new Promise((resolve, reject) => {
      const parts = this.devServerCommand.split(" ");
      const cmd = parts[0];
      const args = parts.slice(1);

      // Option 1: Use terminal for better visibility (recommended)
      const terminal = vscode.window.createTerminal({
        name: "NextVis Dev Server",
        cwd: this.projectRoot,
      });

      terminal.show();
      terminal.sendText(this.devServerCommand);

      // Since we can't easily monitor terminal output, set a longer timeout
      // and notify the user to check if the server is running
      setTimeout(() => {
        vscode.window.showInformationMessage(
          "Next.js server should be starting. Please check if it's accessible in your browser."
        );
        resolve(null);
      }, 5000);
    });
  }

  stopDevServer() {
    return new Promise((resolve) => {
      if (!this.serverProcess) {
        resolve();
        return;
      }

      console.log("Stopping dev server...");
      this.cleanUpInstrumentation();

      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", this.serverProcess.pid, "/f", "/t"]);
      } else {
        this.serverProcess.kill("SIGTERM");
        setTimeout(() => {
          if (this.serverProcess) this.serverProcess.kill("SIGKILL");
        }, 5000);
      }

      this.serverProcess.on("exit", () => {
        console.log("Dev server stopped.");
        this.serverProcess = null;
        resolve();
      });
    });
  }

  cleanUpInstrumentation() {
    const instrumentationDir = path.join(this.projectRoot, "nextvis");

    // Restore modified files first
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

module.exports = { DevServer };
