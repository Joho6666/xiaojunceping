import assert from "node:assert/strict";
import { assertSafeArgs, runCLI } from "../ai/cli/cliAdapter";

assert.doesNotThrow(() =>
  assertSafeArgs(["--json", "--model", "gpt-5.1", "codex.cmd", "-", "debug", "models", "o3"]),
);

const unsafe = [
  "gpt-5.1 & calc & rem",
  "ok | whoami",
  "x > out.txt",
  "x < in.txt",
  "x^y",
  "x%PATH%",
  "has space",
  "ok;calc",
  "$(whoami)",
  "`id`",
];

for (const arg of unsafe) {
  assert.throws(() => assertSafeArgs([arg]), /CLI_UNSAFE_ARGUMENT/);
  assert.throws(
    () => runCLI("codex", ["--model", arg], { prompt: "", timeoutMs: 50 }),
    /CLI_UNSAFE_ARGUMENT/,
  );
}

console.log("cli adapter tests passed");
