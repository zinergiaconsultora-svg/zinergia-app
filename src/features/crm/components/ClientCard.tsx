'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/types/crm';
import { MapPin, Phone, ChevronRight, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientCardProps {
    client: Client;
}

export default function ClientCard({ client }: ClientCardProps) {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push(`/dashboard/clients/${client.id}`)}
            className="group bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-500 cursor-pointer relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-16 bg-gradient-to-bl from-white/80 to-transparent rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm border border-white/50",
                        client.type === 'company'
                            ? "bg-blue-50/80 text-blue-600"
                            : "bg-energy-50/80 text-energy-600"
                    )}>
                        {client.type === 'company' ? <Building2 size={22} strokeWidth={1.5} /> : <User size={22} strokeWidth={1.5} />}
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-900 text-lg leading-tight group-hover:text-energy-900 transition-colors">
                            {client.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider border border-transparent",
                                client.type === 'company' ? "bg-blue-100/50 text-blue-700" : "bg-energy-100/50 text-energy-700"
                            )}>
                                {client.type === 'company' ? 'Empresa' : 'Particular'}
                            </span>
                        </div>
                    </div>
                </div>
                <span className={cn(
                    "w-2 h-2 rounded-full ring-4 ring-white/50",
                    client.status === 'new' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse" : "bg-slate-300"
                )} title="Estado" />
            </div>

            {/* Data Points */}
            <div className="space-y-3 mb-6 relative z-10">
                {client.cups ? (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100/50">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">CUPS</span>
                        <span className="text-sm font-mono text-slate-600 bg-slate-50/50 px-2 py-0.5 rounded-lg border border-slate-200/50">
                            {client.cups}
                        </span>
                    </div>
                ) : (
                    <div className="h-8"></div>
                )}
                <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Cia. Actual</span>
                    <span className="text-sm font-medium text-slate-700">{client.current_supplier || '-'}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 relative z-10">
                <div className="flex items-center gap-2 text-slate-400">
                    <MapPin size={14} />
                    <span className="text-xs font-light truncate max-w-[150px]">
                        {client.address || 'Sin dirección'}
                    </span>
                </div>

                <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    {client.phone && (
                        <a
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-xl bg-white/50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors border border-white/60"
                            title="Llamar al cliente"
                            aria-label="Llamar al cliente"
                        >
                            <Phone size={14} />
                        </a>
                    )}
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/10 group-hover:scale-110 transition-transform">
                        <ChevronRight size={16} />
                    </div>
                </div>
            </div>
        </div>
    );
}
