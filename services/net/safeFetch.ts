const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.startsWith("::ffff:")) return isPrivateIpv4(host.slice(7));
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  }
  return isPrivateIpv4(host);
}

export function assertSafeHttpUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("UNSAFE_URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("UNSAFE_URL");
  if (isBlockedHost(parsed.hostname)) throw new Error("UNSAFE_URL");
  return parsed;
}

export async function safeFetch(url: string, init: RequestInit = {}) {
  const parsed = assertSafeHttpUrl(url);
  return fetch(parsed.toString(), init);
}
