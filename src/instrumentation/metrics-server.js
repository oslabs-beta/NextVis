import * as http from "http";

// Server that runs within the VS Code extension
function startMetricsServer(statusBar, vscode) {
  const PORT = 3099;
  const metricsBuffer = [];

  // Track function execution data
  const pendingExecutions = new Map();
  const completedExecutions = [];

  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Endpoint to post metrics data
    if (req.url === "/metrics" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          console.log("[NextVis] Metric received:", data);

          // Process the metric data
          if (data.executionId) {
            if (data.type === "functionStart") {
              pendingExecutions.set(data.executionId, {
                ...data,
                startTime: data.timestamp,
              });
            } else if (data.type === "functionComplete") {
              const startData = pendingExecutions.get(data.executionId);
              if (startData) {
                const duration = data.timestamp - startData.startTime;
                const executionData = {
                  executionId: data.executionId,
                  functionName: data.functionName,
                  url: data.url,
                  method: data.method,
                  startTime: startData.startTime,
                  endTime: data.timestamp,
                  duration: duration,
                  timestamp: data.timestamp,
                };

                completedExecutions.push(executionData);
                pendingExecutions.delete(data.executionId);

                // Keep completedExecutions at a reasonable size
                if (completedExecutions.length > 100) {
                  completedExecutions.shift();
                }
              }
            }
          }

          // Update status bar directly
          statusBar.text = `$(pulse) ${data.functionName}: Last exec ${new Date(
            data.timestamp
          ).toLocaleTimeString()}`;

          // Store metrics in the buffer if needed
          metricsBuffer.push(data);

          // Keep buffer at a reasonable size
          if (metricsBuffer.length > 100) {
            metricsBuffer.shift();
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Endpoint to get processed metrics data
    if (req.url === "/get-metrics" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });

      const metrics = {
        completedExecutions: completedExecutions,
        pendingCount: pendingExecutions.size,
      };

      res.end(JSON.stringify(metrics));
      return;
    }

    // Clear metrics endpoint (optional)
    if (req.url === "/clear" && req.method === "POST") {
      metricsBuffer.length = 0;
      pendingExecutions.clear();
      completedExecutions.length = 0;

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(PORT, () =>
    console.log("[NextVis] Metrics server listening on port", PORT)
  );

  statusBar.text = "$(pulse) NextVis: Connected";

  return {
    stop: () => {
      server.close();
      statusBar.text = "$(error) NextVis: Disconnected";
    },
    getMetrics: () => {
      return {
        completedExecutions: completedExecutions,
        pendingCount: pendingExecutions.size,
      };
    },
  };
}

export { startMetricsServer };
