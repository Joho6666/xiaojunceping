import { ProviderId } from '../types';
import { checkProviderCLI, getSecret, listConnections } from './connectionService';
import { codexCliAdapter } from '../ai/cli/codexCliAdapter';
export function getProviderConnection(provider:ProviderId){return listConnections().filter(x=>x.provider===provider&&x.status==='connected').sort((a,b)=>(b.lastCheckedAt||'').localeCompare(a.lastCheckedAt||''))[0]||null}
export function resolveProvider(provider:ProviderId){const connection=getProviderConnection(provider);if(!connection)return{status:'unavailable' as const,reason:'PROVIDER_REQUIRED'};return{status:'connected' as const,connection,secret:connection.mode==='api-key'?getSecret(connection.id):undefined}}
export async function resolveAnyEvaluationProvider(preferredConnectionId?: string) {
  if (preferredConnectionId) {
    const selected = listConnections().find((item) => item.id === preferredConnectionId && item.status === "connected");
    if (selected) return { status: "connected" as const, provider: selected.provider, connection: selected, secret: selected.mode === "api-key" ? getSecret(selected.id) : undefined, adapter: selected.provider === "openai" ? codexCliAdapter : undefined };
    return { status: "unavailable" as const, reason: "SELECTED_PROVIDER_UNAVAILABLE" };
  }
  const codex = getProviderConnection('openai');
  if (codex?.mode === 'cli' && codex.status === 'connected') return { status: 'connected' as const, provider: 'openai' as const, connection: codex, adapter: codexCliAdapter };
  try {
    const checked = await checkProviderCLI('openai');
    if (checked.connection?.status === 'connected' && checked.health.authenticated) return { status: 'connected' as const, provider: 'openai' as const, connection: checked.connection, adapter: codexCliAdapter };
  } catch {
    // A missing or unavailable CLI should not prevent an available API-key provider from being used.
  }
  const deepseek = resolveProvider('deepseek');
  if (deepseek.status === 'connected' && deepseek.secret) return { ...deepseek, provider: 'deepseek' as const };
  return { status: 'unavailable' as const, reason: 'PROVIDER_REQUIRED' };
}
