import * as inspector from "inspector";
import { EventEmitter } from "events";

export interface MiddlewareInvocation {
  timestamp: number;
  path: string;
  method: string;
  duration: number;
}

export class InspectorInstrumenter extends EventEmitter {
  private session: inspector.Session | null = null;
  private invocations: MiddlewareInvocation[] = [];
  private functionBreakpoints: {
    [fnName: string]: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  } = {};

  // A map from requestId -> partial invocation data
  private inFlightCalls: {
    [requestId: string]: {
      fnName: string;
      startTime: number;
      cpuUsageStart: NodeJS.CpuUsage;
      memoryStart: NodeJS.MemoryUsage;
      callFrames?: inspector.Debugger.Location[];
      args?: any[];
    };
  } = {};

  constructor() {
    super();
  }

  /**
   * Attach a new inspector session to the given TCP port.
   */
  public async attachToDevServer(port: number = 9229): Promise<void> {
    this.session = new inspector.Session();
    console.log(`[InspectorInstrumenter] Attaching to port ${port}`);

    try {
      // Either cast to 'any' or use @ts-ignore. Both suppress the older TS definitions
      // that do not accept a URL argument for connect().
      //
      // 1) Using an @ts-ignore:
      // @ts-ignore
      this.session.connect(`ws://127.0.0.1:${port}`);

      // 2) Alternatively, we can cast:
      // (this.session as any).connect(`ws://127.0.0.1:${port}`);

      // Enable required domains
      await this.postAsync("Debugger.enable", {});
      await this.postAsync("Runtime.enable", {});
      await this.postAsync("Profiler.enable", {});
      console.log(
        "[InspectorInstrumenter] Inspector domains enabled successfully"
      );

      // Set up event handlers
      this.session.on("Debugger.paused", this.handleDebuggerPaused.bind(this));
      this.session.on(
        "Runtime.executionContextCreated",
        this.handleContextCreated.bind(this)
      );
    } catch (err) {
      console.error("[InspectorInstrumenter] Failed to attach:", err);
      throw err;
    }
  }

  private handleDebuggerPaused(params: any): void {
    // Here you can capture information about paused events, stack frames, etc.
    console.log("[InspectorInstrumenter] Debugger paused:", params);
  }

  private handleContextCreated(params: any): void {
    // Handler for when a new execution context is created
    console.log("[InspectorInstrumenter] New execution context:", params);
  }

  /**
   * Provide the functions and their lineNumbers etc. that we want to instrument
   */
  public async instrumentFunctions(
    functionInfos: Array<{
      fnName: string;
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    }>
  ) {
    // Store them so we can set breakpoints when scriptParsed arrives
    for (const info of functionInfos) {
      this.functionBreakpoints[info.fnName] = {
        filePath: info.filePath,
        lineNumber: info.lineNumber,
        columnNumber: info.columnNumber,
      };
    }
  }

  /**
   * Return a copy of invocations
   */
  public getInvocations(): MiddlewareInvocation[] {
    return this.invocations;
  }

  public dispose(): void {
    if (this.session) {
      try {
        this.session.disconnect();
      } catch (err) {
        console.error("[InspectorInstrumenter] Error disconnecting:", err);
      }
      this.session = null;
    }
    this.removeAllListeners();
  }

  // Helper: measure CPU + mem
  private async getCpuMemUsage(): Promise<
    [NodeJS.CpuUsage, NodeJS.MemoryUsage]
  > {
    // Evaluate in the debugee process
    const cpuUsage = await this.evaluateInGlobal(
      `JSON.stringify(process.cpuUsage())`
    );
    const memUsage = await this.evaluateInGlobal(
      `JSON.stringify(process.memoryUsage())`
    );
    // Parse
    const cpu = JSON.parse(cpuUsage.result.value ?? "{}");
    const mem = JSON.parse(memUsage.result.value ?? "{}");
    return [cpu, mem];
  }

  // Evaluate code in global scope
  private evaluateInGlobal(
    expression: string
  ): Promise<inspector.Runtime.EvaluateReturnType> {
    return new Promise((resolve, reject) => {
      this.session?.post(
        "Runtime.evaluate",
        {
          expression,
          returnByValue: true,
        },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  // Evaluate code in top call frame (example usage if you want advanced debugging)
  private evaluateInTopFrame(
    expression: string
  ): Promise<inspector.Runtime.EvaluateReturnType> {
    return new Promise((resolve, reject) => {
      this.session?.post(
        "Debugger.evaluateOnCallFrame",
        {
          callFrameId: "0",
          expression,
          returnByValue: true,
        },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  private postAsync(method: string, params: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.session) {
        return reject(
          new Error("[InspectorInstrumenter] No inspector session available")
        );
      }
      this.session.post(method, params, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }
}
