import { syncKnowledge } from "../services/knowledgeSyncService";

syncKnowledge().then((run) => {
  console.log(JSON.stringify(run, null, 2));
  process.exitCode = run.status === "failed" ? 1 : 0;
});
