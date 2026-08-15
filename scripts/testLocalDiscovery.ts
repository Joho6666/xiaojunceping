import { discoverLocalCapabilities } from "../services/localCapabilityDiscoveryService";

(async () => {
  const result = await discoverLocalCapabilities();
  if (result.items.some((item) => item.sensitiveDataRead !== false)) throw new Error("local discovery must never read sensitive data");
  if (result.items.some((item) => Object.keys(item).some((key) => /api.?key|token|secret|cookie|password|env/i.test(key)))) throw new Error("sensitive field leaked into discovery result");
  console.log(`local discovery passed: ${result.items.length} local capabilities, no sensitive fields`);
})();
