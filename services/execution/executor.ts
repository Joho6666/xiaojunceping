import { AgentExecutor, ExecutionTask } from "../../types";

export type { AgentExecutor };

export interface ExecutionResult {
  ok: boolean;
  output: string;
}

export class MockAgentExecutor implements AgentExecutor {
  id = "mock-test-adapter";
  async available() {
    return true;
  }
  async execute(task: Pick<ExecutionTask, "id" | "title">, _context: Record<string, unknown> = {}) {
    return { ok: true, output: `mock executed ${task.id}: ${task.title}` };
  }
}
