import { ProviderId } from '../types';
import { getSecret, listConnections } from './connectionService';
export function getProviderConnection(provider:ProviderId){return listConnections().filter(x=>x.provider===provider&&x.status==='connected').sort((a,b)=>(b.lastCheckedAt||'').localeCompare(a.lastCheckedAt||''))[0]||null}
export function resolveProvider(provider:ProviderId){const connection=getProviderConnection(provider);if(!connection)return{status:'unavailable' as const,reason:'PROVIDER_REQUIRED'};return{status:'connected' as const,connection,secret:connection.mode==='api-key'?getSecret(connection.id):undefined}}
