import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        {
            error: 'Deprecated',
            message: 'Este endpoint está obsoleto. Usa los Server Actions en su lugar.',
        },
        { status: 410 } // 410 Gone
    );
}