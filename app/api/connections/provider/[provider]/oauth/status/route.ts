import { NextResponse } from 'next/server'; import { oauthUnavailable } from '../../../../../../../services/connectionService'; import { ProviderId } from '../../../../../../../types';
export async function GET(_:Request,{params}:{params:{provider:string}}){return NextResponse.json(oauthUnavailable(params.provider as ProviderId))}
