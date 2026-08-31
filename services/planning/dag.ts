import { ExecutionTask } from "../../types";

export function detectCycle(tasks: ExecutionTask[]): string[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycle: string[] = [];
  const walk = (id: string, stack: string[]): boolean => {
    if (visiting.has(id)) {
      cycle.push(...stack.slice(stack.indexOf(id)), id);
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    const task = byId.get(id);
    for (const next of task?.dependsOn || []) {
      if (walk(next, [...stack, id])) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const task of tasks) {
    if (walk(task.id, [])) return cycle;
  }
  return [];
}

export function topologicalSort(tasks: ExecutionTask[]): ExecutionTask[] {
  if (detectCycle(tasks).length) throw new Error("TASK_DAG_CYCLE");
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const done: ExecutionTask[] = [];
  while (remaining.size) {
    const ready = Array.from(remaining.values()).filter((task) => (task.dependsOn || []).every((id) => !remaining.has(id)));
    if (!ready.length) throw new Error("TASK_DAG_CYCLE");
    ready.forEach((task) => {
      done.push(task);
      remaining.delete(task.id);
    });
  }
  return done;
}
