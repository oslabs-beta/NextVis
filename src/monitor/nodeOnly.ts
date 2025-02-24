import * as inspector from "inspector";
import { InspectorInstrumenter } from "./inspectorInstrumenter";

/**
 * Simple helper, if you want it. You can attach directly from your extension code
 * or keep this as a utility.
 */
export async function createAndAttachInspector(
  port: number
): Promise<InspectorInstrumenter> {
  const instrumenter = new InspectorInstrumenter();
  await instrumenter.attachToDevServer(port);
  return instrumenter;
}