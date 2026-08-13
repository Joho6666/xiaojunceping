import { NextResponse } from 'next/server'; import { removeConnection } from '../../../../services/connectionService';
export async function DELETE(_:Request,{params}:{params:{id:string}}){removeConnection(params.id);return NextResponse.json({ok:true})}
