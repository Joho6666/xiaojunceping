import { NextResponse } from 'next/server'; import { removeConnection } from '../../../../services/connectionService';
export async function DELETE(_:Request,{params:paramsPromise}:{params:Promise<{id:string}>}){const params=await paramsPromise;removeConnection(params.id);return NextResponse.json({ok:true})}
