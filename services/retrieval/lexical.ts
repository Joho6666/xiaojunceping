export function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((token) => token.length > 1);
}

export function bm25Score(queryTokens: string[], documentTokens: string[], avgDl = 24, k1 = 1.2, b = 0.75) {
  if (!queryTokens.length || !documentTokens.length) return 0;
  const tf = new Map<string, number>();
  for (const token of documentTokens) tf.set(token, (tf.get(token) || 0) + 1);
  const dl = documentTokens.length;
  let score = 0;
  for (const token of queryTokens) {
    const freq = tf.get(token) || 0;
    if (!freq) continue;
    const idf = Math.log(1 + 1 / (1 + freq));
    score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (dl / avgDl))));
  }
  return Number((score * 20).toFixed(2));
}
