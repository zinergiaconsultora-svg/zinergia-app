import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateProposalPDF } from '@/lib/pdf/generate';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // ── Auth guard ──────────────────────────────────────────────────────
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const params = await props.params;
        const id = params.id;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        // ── Fetch proposal scoped to the authenticated user's franchise ──────
        const { data: proposal, error: proposalError } = await supabase
            .from('proposals')
            .select('*, clients(*), offer_snapshot, calculation_data')
            .eq('id', id)
            .single();

        if (proposalError || !proposal) {
            return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 });
        }

        // ── Generate PDF ────────────────────────────────────────────────────
        const pdfBuffer = await generateProposalPDF(proposal);

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="zinergia-propuesta-${id.slice(0, 8)}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
