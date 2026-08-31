import assert from "node:assert/strict";
import { detectCycle, topologicalSort } from "../services/planning/dag";
import { MockAgentExecutor } from "../services/execution/executor";

const ok = [
  { id: "A", requirementIds: [], componentId: "c", title: "A", toolIds: [], acceptanceCriteria: ["a"], dependsOn: [] },
  { id: "B", requirementIds: [], componentId: "c", title: "B", toolIds: [], acceptanceCriteria: ["b"], dependsOn: ["A"] },
];
assert.deepEqual(topologicalSort(ok).map((item) => item.id), ["A", "B"]);
const bad = [
  { id: "A", requirementIds: [], componentId: "c", title: "A", toolIds: [], acceptanceCriteria: ["a"], dependsOn: ["B"] },
  { id: "B", requirementIds: [], componentId: "c", title: "B", toolIds: [], acceptanceCriteria: ["b"], dependsOn: ["A"] },
];
assert.ok(detectCycle(bad).length >= 2);
assert.throws(() => topologicalSort(bad));

(async () => {
  const executor = new MockAgentExecutor();
  assert.equal(await executor.available(), true);
  const result = await executor.execute({ id: "TASK-01", title: "A" }, {});
  assert.equal(result.ok, true);
  console.log("task dag tests passed");
})();
