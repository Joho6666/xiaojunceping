import { ProviderId } from '../../types'; import { createCLIAdapter } from './cliAdapter'; export function checkCLI(provider:ProviderId){return createCLIAdapter(provider).healthCheck()}
