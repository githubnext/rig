import type { Tool } from "../rig.ts";

export function objectToolSchema(tool: Tool<any>): Record<string, unknown> & { type: "object" } {
  const parameters = tool.parameters ?? { type: "object", properties: {} };
  if (parameters["type"] !== "object") {
    throw new TypeError(`${tool.name} tool parameters must be an object schema`);
  }
  return parameters as Record<string, unknown> & { type: "object" };
}

export function toolResultText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result === undefined) {
    return "";
  }
  return JSON.stringify(result);
}
