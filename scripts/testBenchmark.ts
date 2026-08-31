import assert from "node:assert/strict";
import { goldenCases } from "../tests/evaluation-cases/cases";

assert.ok(goldenCases.length >= 50, `need 50 golden cases, got ${goldenCases.length}`);
console.log(`benchmark size ok: ${goldenCases.length}`);
