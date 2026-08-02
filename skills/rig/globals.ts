/**
 * Ambient workflow context helpers.
 *
 * Import from `"rig/globals"` to access `call`, `pipeline`, and `parallel`
 * as module-level functions that automatically delegate to the active workflow
 * run via `currentWorkflow()`.  This keeps rig programs that port from
 * Claude dynamic workflows readable without threading context explicitly.
 *
 * @example
 * ```ts
 * import { call, pipeline } from "rig/globals";
 * import { agent } from "rig";
 *
 * const worker = agent({ name: "worker", instructions: "Do work." });
 * const results = await pipeline(inputs, (item) => call(worker, item));
 * ```
 *
 * @module rig/globals
 */
import type {
  AgentFn,
  AgentInputValue,
  InferSchema,
  PromptBuilder,
  Schema,
  Workflow,
  WorkflowCall,
  WorkflowCallOptions,
  WorkflowNestedOptions,
} from "rig";
import { currentWorkflow, parallel, pipeline } from "rig";

function requireContext(label: string): WorkflowCall {
  const ctx = currentWorkflow();
  if (ctx === undefined) {
    throw new Error(`${label} requires an active workflow run (call inside runWorkflow or a launcher program).`);
  }
  return ctx.call;
}

function callImpl<Input, Output>(
  worker: AgentFn<Input, Output>,
  input: AgentInputValue<Input>,
  options?: WorkflowCallOptions,
): Promise<Output | null> {
  return requireContext("call()")(worker, input, options);
}

callImpl.text = (prompt: string | PromptBuilder, options?: WorkflowCallOptions): Promise<string | null> =>
  requireContext("call.text()").text(prompt, options);

callImpl.json = <const Output extends Schema>(
  prompt: string | PromptBuilder,
  output: Output,
  options?: WorkflowCallOptions,
): Promise<InferSchema<Output> | null> =>
  requireContext("call.json()").json(prompt, output, options);

callImpl.workflow = <Input, Output>(
  child: Workflow<Input, Output>,
  args?: Input,
  options?: WorkflowNestedOptions,
): Promise<Output> =>
  requireContext("call.workflow()").workflow(child, args, options);

/**
 * Ambient workflow call.  Delegates to the active `WorkflowContext.call`,
 * which routes through the shared concurrency limiter and agent budget.
 * Throws if called outside a workflow run.
 */
export const call: WorkflowCall = callImpl as unknown as WorkflowCall;

export { pipeline, parallel };
