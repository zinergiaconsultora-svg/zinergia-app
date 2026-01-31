'use client';

import React, { useMemo } from 'react';
import useSWR from 'swr';
import { crmService } from '@/services/crmService';
import { Proposal } from '@/types/crm';
import { PieChart, Plus, Clock, Users, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface AuditGroup {
    client_id: string;
    clientName: string;
    date: string;
    items: Proposal[];
}

// SWR fetcher function
const fetchProposals = async () => {
    return crmService.getRecentProposals();
};

export default function ProposalsPage() {
    // Use SWR for data fetching with caching
    const { data: proposals = [], isLoading } = useSWR(
        'recent-proposals',
        fetchProposals,
        {
            revalidateOnFocus: false,
            dedupingInterval: 5000,
            refreshInterval: 30000, // Refresh every 30 seconds
        }
    );

    // Memoize grouped proposals calculation - Optimized to O(n log n)
    const groupedProposals = useMemo(() => {
        const timeThreshold = 5 * 60 * 1000; // 5 minutes
        
        // First pass: group proposals
        const groups = proposals.reduce((acc: Map<string, AuditGroup>, current: Proposal) => {
            const currentDate = new Date(current.created_at).getTime();
            const groupKey = `${current.client_id}-${Math.floor(currentDate / timeThreshold)}`;
            
            const existingGroup = acc.get(groupKey);
            
            if (existingGroup) {
                existingGroup.items.push(current);
            } else {
                acc.set(groupKey, {
                    client_id: current.client_id,
                    clientName: current.clients?.name || 'Cliente Desconocido',
                    date: current.created_at,
                    items: [current]
                });
            }
            return acc;
        }, new Map());
        
        // Second pass: sort each group once (O(n log n) total instead of O(n² log n))
        groups.forEach(group => {
            group.items.sort((a: Proposal, b: Proposal) => b.annual_savings - a.annual_savings);
        });
        
        return Array.from(groups.values());
    }, [proposals]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Auditorías & Propuestas</h1>
                    <p className="text-slate-500 font-medium text-sm">Historial de optimizaciones generadas por cliente.</p>
                </div>
                <Link
                    href="/dashboard/comparator"
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-500/10 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 active:scale-95 text-sm"
                >
                    <Plus size={18} />
                    Nueva Auditoría
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-64 bg-white rounded-[2rem] border border-slate-100 animate-pulse shadow-sm" />
                    ))}
                </div>
            ) : groupedProposals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {groupedProposals.map((group) => (
                        <div
                            key={`${group.client_id}-${group.date}`}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all overflow-hidden flex flex-col group"
                        >
                            {/* Card Header: Client Info */}
                            <div className="p-6 pb-4 flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                        {group.clientName}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1.5">
                                        <Clock size={12} className="text-slate-300" />
                                        Sesión: {new Date(group.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <Users size={18} />
                                </div>
                            </div>

                            {/* Options List */}
                            <div className="flex-1 p-6 pt-2 space-y-4">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1 opacity-70">Opciones Generadas</p>
                                <div className="space-y-3">
                                    {group.items.map((p: Proposal, idx: number) => (
                                        <Link
                                            href={`/dashboard/proposals/${p.id}`}
                                            key={p.id}
                                            className="block p-4 bg-slate-50/50 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-md transition-all relative overflow-hidden group/item"
                                        >
                                            <div className="relative z-10 flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${idx === 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                            {idx === 0 ? 'Opción A' : 'Opción B'}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-800">{p.offer_snapshot.marketer_name}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] md:max-w-full">
                                                        {p.offer_snapshot.tariff_name}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ahorro</p>
                                                    <p className="text-base font-bold text-emerald-600">
                                                        +{Math.round(p.annual_savings)}€
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Status Badge Mini */}
                                            <div className={`absolute top-0 right-0 h-full w-1 ${p.status === 'accepted' ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Footer: Quick Summary */}
                            <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between group-hover:bg-indigo-50/30 transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <TrendingUp size={14} className="text-indigo-600" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ahorro Máximo</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-lg font-bold text-slate-900 leading-none">
                                        {Math.round(group.items[0]?.annual_savings || 0)}€
                                    </span>
                                    <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter mt-1">Anuales</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] p-16 text-center border border-slate-100 shadow-sm max-w-2xl mx-auto mt-12">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <PieChart size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Sin auditorías</h3>
                    <p className="text-slate-500 mb-10 text-base leading-relaxed">
                        Inicia una simulación para ver las mejores ofertas.
                    </p>
                    <Link
                        href="/dashboard/comparator"
                        className="inline-flex items-center gap-2.5 px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold shadow-2xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Abrir Simulador
                    </Link>
                </div>
            )}
        </div>
    );
}
