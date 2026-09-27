import { NextResponse } from 'next/server'; import { oauthUnavailable } from '../../../../../../../services/connectionService'; import { ProviderId } from '../../../../../../../types';
export async function GET(_:Request,{params:paramsPromise}:{params:Promise<{provider:string}>}){const params=await paramsPromise;return NextResponse.json(oauthUnavailable(params.provider as ProviderId))}
