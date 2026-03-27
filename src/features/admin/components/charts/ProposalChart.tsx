'use client';

import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from 'recharts';
import type { ProposalTimeSeriesPoint } from '@/app/actions/admin';

interface Props {
    data: ProposalTimeSeriesPoint[];
}

const COLORS = {
    draft: '#94a3b8',    // slate
    sent: '#3b82f6',     // blue
    accepted: '#10b981', // emerald
    rejected: '#ef4444', // red
    conversion: '#f59e0b', // amber line
};

function formatMonth(month: string) {
    const [y, m] = month.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviadas',
    accepted: 'Aceptadas',
    rejected: 'Rechazadas',
    conversionRate: '% Conversión',
};

export default function ProposalChart({ data }: Props) {
    const hasData = data.some(d => d.total > 0);

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Pipeline de Propuestas</h3>
            </div>

            {!hasData ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-slate-600">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="text-sm">Sin propuestas registradas aún</p>
                    <p className="text-xs text-slate-600 mt-1">Las propuestas aparecerán cuando los agentes generen simulaciones</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#64748b" fontSize={12} />
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} unit="%" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: 8 }}
                            labelFormatter={formatMonth}
                            formatter={((value: number, name: string) => {
                                const label = STATUS_LABELS[name] ?? name;
                                return name === 'conversionRate' ? [`${value}%`, label] : [value, label];
                            }) as never}
                        />
                        <Legend formatter={(value: string) => STATUS_LABELS[value] ?? value} />
                        <Bar yAxisId="left" dataKey="accepted" stackId="stack" fill={COLORS.accepted} radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="left" dataKey="sent" stackId="stack" fill={COLORS.sent} />
                        <Bar yAxisId="left" dataKey="draft" stackId="stack" fill={COLORS.draft} />
                        <Bar yAxisId="left" dataKey="rejected" stackId="stack" fill={COLORS.rejected} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke={COLORS.conversion} strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
