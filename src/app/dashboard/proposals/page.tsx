'use client';

import React, { useEffect, useState } from 'react';
import { crmService } from '@/services/crmService';
import { Proposal } from '@/types/crm';
import { PieChart, Plus, ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';

export default function ProposalsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadProposals() {
            try {
                // Since we don't have a direct "getAllProposals" yet, we'll try to fetch dashboard stats 
                // which often has recent proposals, or we'll need to add a method.
                // For now, let's try to fetch them from supabase directly or add a service method.
                // I'll add getProposals() to crmService in a moment.
                const data = await crmService.getRecentProposals();
                setProposals(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        loadProposals();
    }, []);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'accepted': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'sent': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'rejected': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Propuestas</h1>
                    <p className="text-slate-500 font-medium">Gestiona y haz seguimiento de tus ofertas comerciales.</p>
                </div>
                <Link
                    href="/dashboard/comparator"
                    className="flex items-center gap-2 px-6 py-3 bg-energy-600 text-white rounded-2xl font-bold shadow-lg shadow-energy-500/20 hover:bg-energy-700 transition-all hover:scale-[1.02]"
                >
                    <Plus size={20} />
                    Nueva Propuesta
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white rounded-3xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            ) : proposals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {proposals.map((p) => (
                        <Link
                            key={p.id}
                            href={`/dashboard/proposals/${p.id}`}
                            className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-energy-200 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(p.status)}`}>
                                    {p.status}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(p.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h3 className="font-bold text-slate-900 mb-1 group-hover:text-energy-700 transition-colors">
                                {p.offer_snapshot.marketer_name}
                            </h3>
                            <p className="text-xs text-slate-500 mb-6">{p.offer_snapshot.tariff_name}</p>

                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ahorro Anual</p>
                                    <p className="text-2xl font-black text-emerald-600">
                                        {Math.round(p.annual_savings)}€
                                    </p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-energy-50 group-hover:text-energy-600 transition-all">
                                    <ArrowRight size={20} />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-100">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                        <PieChart size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No hay propuestas aún</h3>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                        Comienza a ahorrar dinero a tus clientes creando tu primera simulación comparativa.
                    </p>
                    <Link
                        href="/dashboard/comparator"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all"
                    >
                        Abrir Simulador
                    </Link>
                </div>
            )}
        </div>
    );
}
