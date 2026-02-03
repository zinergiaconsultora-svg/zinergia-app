import { NextRequest, NextResponse } from 'next/server';
import { crmService } from '@/services/crmService';
import { generateProposalPDF } from '@/lib/pdf/generate';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const id = params.id;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        // 1. Fetch Proposal
        const proposal = await crmService.getProposalById(id);
        if (!proposal) {
            return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
        }

        // 2. Generate PDF
        const pdfBuffer = await generateProposalPDF(proposal);

        // 3. Return as PDF Stream
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
