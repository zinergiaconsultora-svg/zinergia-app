'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/types/crm';
import { MapPin, Phone, Mail, ChevronRight, User, Building2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/primitives/Card';

interface ClientCardProps {
    client: Client;
}

const STATUS_STYLES = {
    new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 ring-blue-500/30',
    contacted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 ring-amber-500/30',
    in_process: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 ring-violet-500/30',
    won: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 ring-emerald-500/30',
    lost: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 ring-red-500/30',
};

const STATUS_LABELS = {
    new: 'Nuevo',
    contacted: 'Contactado',
    in_process: 'En Proceso',
    won: 'Ganado',
    lost: 'Perdido',
};

export default function ClientCard({ client }: ClientCardProps) {
    const router = useRouter();

    const handleClick = useCallback(() => {
        router.push(`/dashboard/clients/${client.id}`);
    }, [router, client.id]);

    return (
        <Card
            onClick={handleClick}
            className="group hover:shadow-floating hover:-translate-y-1 relative overflow-hidden p-6 cursor-pointer bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-white/50 border dark:border-slate-800 transition-all duration-300 min-h-[220px] flex flex-col"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:from-indigo-500/10 transition-colors duration-500"></div>

            {/* Header: Icon & Name & Status */}
            <div className="flex justify-between items-start mb-5 relative z-10 gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                        "w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm border",
                        client.type === 'company'
                            ? "bg-gradient-to-br from-blue-50 to-indigo-50/50 text-blue-600 border-blue-100 dark:border-blue-900/30"
                            : "bg-gradient-to-br from-energy-50 to-orange-50/50 text-energy-600 border-energy-100 dark:border-energy-900/30"
                    )}>
                        {client.type === 'company' ? <Building2 size={22} strokeWidth={1.5} /> : <User size={22} strokeWidth={1.5} />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg leading-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {client.name}
                        </h3>
                        <div className="flex items-center mt-1.5">
                            <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                                STATUS_STYLES[client.status]
                            )}>
                                {STATUS_LABELS[client.status]}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Value Data */}
            <div className="grid grid-cols-2 gap-3 mb-5 relative z-10 flex-1">
                {(client.average_monthly_bill && client.average_monthly_bill > 0) ? (
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5 flex items-center gap-1">
                            <TrendingUp size={12} className="text-indigo-500" /> Valor Estimado
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(client.average_monthly_bill)}/mes
                        </span>
                    </div>
                ) : (
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">CUPS principal</span>
                        <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">
                            {client.cups ? client.cups.substring(0, 16) + '...' : 'Falta CUPS'}
                        </span>
                    </div>
                )}
                
                <div className="bg-slate-50/50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Compañía actual</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {client.current_supplier || 'Desconocida'}
                    </span>
                </div>
            </div>

            {/* Footer / Quick Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 relative z-10">
                <div className="flex items-center gap-2 text-slate-400">
                    <MapPin size={14} className="shrink-0" />
                    <span className="text-xs font-light truncate max-w-[130px]">
                        {client.address || 'Sin dirección'}
                    </span>
                </div>

                <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    {client.phone && (
                        <a
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                            title="Llamar"
                        >
                            <Phone size={14} />
                        </a>
                    )}
                    {client.email && (
                        <a
                            href={`mailto:${client.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 flex items-center justify-center transition-colors"
                            title="Enviar correo"
                        >
                            <Mail size={14} />
                        </a>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform ml-1">
                        <ChevronRight size={16} />
                    </div>
                </div>
            </div>
        </Card>
    );
}
