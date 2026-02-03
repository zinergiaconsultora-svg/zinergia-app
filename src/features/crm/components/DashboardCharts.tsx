'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/utils/format';

// Dynamic imports for recharts components to reduce bundle size
const ResponsiveContainer = dynamic(
    () => import('recharts').then((mod) => mod.ResponsiveContainer),
    { ssr: false }
);
const AreaChart = dynamic(
    () => import('recharts').then((mod) => mod.AreaChart),
    { ssr: false }
);
const Area = dynamic(
    () => import('recharts').then((mod) => mod.Area),
    { ssr: false }
);
const Tooltip = dynamic(
    () => import('recharts').then((mod) => mod.Tooltip),
    { ssr: false }
);
const PieChart = dynamic(
    () => import('recharts').then((mod) => mod.PieChart),
    { ssr: false }
);
const Pie = dynamic(
    () => import('recharts').then((mod) => mod.Pie),
    { ssr: false }
);
const Cell = dynamic(
    () => import('recharts').then((mod) => mod.Cell),
    { ssr: false }
);

// Static style objects defined outside components to prevent recreation on every render
const TOOLTIP_CONTENT_STYLE = {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(0,0,0,0.05)',
    borderRadius: '12px',
    color: '#1e293b',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
} as const;

const TOOLTIP_ITEM_STYLE = { color: '#059669', fontWeight: 500 } as const;
const TOOLTIP_CURSOR_STYLE = { stroke: '#e2e8f0', strokeWidth: 1 } as const;

const PIE_TOOLTIP_CONTENT_STYLE = {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid rgba(0,0,0,0.05)',
    borderRadius: '12px',
    color: '#1e293b',
    fontSize: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
} as const;

const PIE_TOOLTIP_ITEM_STYLE = { color: '#1e293b' } as const;

export const SavingsTrendChart = () => {
    // MOCK DATA for Visual Demonstration
    const data = [
        { name: 'Jul', value: 12000 },
        { name: 'Ago', value: 18500 },
        { name: 'Sep', value: 15000 },
        { name: 'Oct', value: 24000 },
        { name: 'Nov', value: 32000 },
        { name: 'Dic', value: 38500 },
        { name: 'Ene', value: 45000 },
    ];

    return (
        <div className="h-full w-full">
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            contentStyle={TOOLTIP_CONTENT_STYLE}
                            itemStyle={TOOLTIP_ITEM_STYLE}
                            cursor={TOOLTIP_CURSOR_STYLE}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [formatCurrency(value), 'Ahorro']}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorSavings)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const PipelinePieChart = ({
    active,
    won,
    lost
}: {
    active: number,
    won: number,
    lost: number
}) => {
    // Pastel/Clean Palette
    const data = [
        { name: 'Ganadas', value: won, color: '#34d399' }, // Emerald-400
        { name: 'En Proceso', value: active, color: '#818cf8' }, // Indigo-400
        { name: 'Perdidas', value: lost, color: '#cbd5e1' }, // Slate-300
    ];

    return (
        <div className="h-full w-full relative">
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={55}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={PIE_TOOLTIP_CONTENT_STYLE}
                            itemStyle={PIE_TOOLTIP_ITEM_STYLE}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Center Text */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="block text-xl md:text-2xl font-light text-slate-700 tracking-tight">{active + won}</span>
                <span className="text-[10px] uppercase font-medium text-slate-400 tracking-wider">Total</span>
            </div>
        </div>
    );
};
