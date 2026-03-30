import { getPublicProposalAction } from '@/app/actions/publicProposal';
import { notFound } from 'next/navigation';
import PublicProposalClient from './PublicProposalClient';
import type { Metadata } from 'next';

interface Props {
    params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const proposal = await getPublicProposalAction(token);
    if (!proposal) return { title: 'Propuesta no encontrada — Zinergia' };

    const savings = Math.round(proposal.annual_savings);
    return {
        title: `Propuesta de ahorro: ${savings.toLocaleString('es-ES')}€/año — Zinergia`,
        description: `Tu asesor energético te ha preparado un estudio personalizado. Ahorra ${savings.toLocaleString('es-ES')}€ al año en tu factura de luz.`,
        robots: { index: false, follow: false }, // No indexar propuestas privadas
    };
}

export default async function PublicProposalPage({ params }: Props) {
    const { token } = await params;
    const proposal = await getPublicProposalAction(token);

    if (!proposal) notFound();

    return <PublicProposalClient proposal={proposal} token={token} />;
}
