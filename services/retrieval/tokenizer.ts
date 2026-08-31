const STOP = new Set(["the", "and", "for", "with", "this", "that", "from", "your"]);

export function tokenize(value: string): string[] {
  const text = (value || "").toLowerCase();
  const tokens: string[] = [];
  const parts = text.split(/([a-z0-9]+)|([^\u0000-\u007f]+)/).filter(Boolean);
  for (const part of parts) {
    if (/^[a-z0-9]+$/.test(part)) {
      if (part.length > 1 && !STOP.has(part)) tokens.push(part);
      continue;
    }
    const cjk = part.replace(/[^\u4e00-\u9fff]/g, "");
    if (!cjk) continue;
    if (cjk.length === 1) tokens.push(cjk);
    for (let i = 0; i < cjk.length; i++) {
      tokens.push(cjk[i]);
      if (i + 1 < cjk.length) tokens.push(cjk.slice(i, i + 2));
      if (i + 2 < cjk.length) tokens.push(cjk.slice(i, i + 3));
      if (i + 3 < cjk.length) tokens.push(cjk.slice(i, i + 4));
    }
  }
  return tokens;
}
