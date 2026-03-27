'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TimeSeriesPoint } from '@/app/actions/admin';

interface Props {
    data: TimeSeriesPoint[];
}

const COLORS = {
    pending: '#f59e0b',   // amber
    approved: '#10b981',  // emerald
    paid: '#8b5cf6',      // violet
};

function formatMonth(month: string) {
    const [y, m] = month.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function formatCurrency(value: number) {
    return `${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

export default function CommissionChart({ data }: Props) {
    const hasData = data.some(d => d.total > 0);

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Evolución de Comisiones</h3>
            </div>

            {!hasData ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-slate-600">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    <p className="text-sm">Sin datos de comisiones aún</p>
                    <p className="text-xs text-slate-600 mt-1">Las comisiones aparecerán cuando se procesen propuestas</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.pending} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.pending} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.approved} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.approved} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.paid} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.paid} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#64748b" fontSize={12} />
                        <YAxis tickFormatter={formatCurrency} stroke="#64748b" fontSize={12} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: 8 }}
                            labelFormatter={formatMonth}
                            formatter={((value: number, name: string) => [formatCurrency(value ?? 0), name === 'pending' ? 'Pendientes' : name === 'approved' ? 'Aprobadas' : 'Pagadas']) as never}
                        />
                        <Legend formatter={(value: string) => value === 'pending' ? 'Pendientes' : value === 'approved' ? 'Aprobadas' : 'Pagadas'} />
                        <Area type="monotone" dataKey="paid" stackId="1" stroke={COLORS.paid} fill="url(#gradPaid)" />
                        <Area type="monotone" dataKey="approved" stackId="1" stroke={COLORS.approved} fill="url(#gradApproved)" />
                        <Area type="monotone" dataKey="pending" stackId="1" stroke={COLORS.pending} fill="url(#gradPending)" />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
