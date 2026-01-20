'use client';

import React, { useEffect, useState } from 'react';
import { crmService } from '@/services/crmService';
import { Proposal } from '@/types/crm';
import ProposalView from '@/features/crm/components/ProposalView';
import { useParams, useRouter } from 'next/navigation';

export default function ProposalDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        async function fetchProposal() {
            try {
                const data = await crmService.getProposalById(id);
                setProposal(data);
            } catch (err) {
                console.error(err);
                setError('No se pudo cargar la propuesta. Puede que no exista o no tengas permisos.');
            } finally {
                setLoading(false);
            }
        }

        fetchProposal();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F8F9FC]">
                <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !proposal) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FC] text-slate-500">
                <p className="mb-4">{error || 'Propuesta no encontrada'}</p>
                <button
                    onClick={() => router.back()}
                    className="text-indigo-600 font-medium hover:underline"
                >
                    Volver
                </button>
            </div>
        );
    }

    return (
        <ProposalView initialProposal={proposal} />
    );
}
