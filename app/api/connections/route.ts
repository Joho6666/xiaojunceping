import { NextRequest, NextResponse } from 'next/server';
import { addApiKey, listConnections } from '../../../services/connectionService';
import { ProviderId } from '../../../types';
export async function GET(){return NextResponse.json({connections:listConnections()})}
export async function POST(request:NextRequest){try{const body=await request.json() as {provider?:ProviderId;apiKey?:string;baseUrl?:string;model?:string};if(!body.provider||!body.apiKey)return NextResponse.json({error:'provider_and_api_key_required'}, {status:400});return NextResponse.json({connection:addApiKey(body.provider,body.apiKey,body.baseUrl,body.model)},{status:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'CONNECTION_ERROR'},{status:400})}}
