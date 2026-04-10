import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { ProposalDocument } from './ProposalDocument';
import { Proposal } from '@/types/crm';

export async function generateProposalPDF(proposal: Proposal): Promise<Buffer> {
    const stream = await renderToStream(<ProposalDocument proposal={proposal} />);

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
    }
    return Buffer.concat(chunks);
}
