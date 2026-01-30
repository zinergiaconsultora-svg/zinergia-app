'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BreakdownProps {
    powerCost: number;
    energyCost: number;
}

export const EnergyPowerBreakdown: React.FC<BreakdownProps> = ({ powerCost, energyCost }) => {
    const data = [
        { name: 'Potencia (Fijo)', value: powerCost, color: '#f59e0b' }, // Amber/Orange
        { name: 'Energía (Variable)', value: energyCost, color: '#3b82f6' }, // Blue
    ];

    const formatEuro = (value: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

    return (
        <div className="h-[300px] w-full bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Distribución de Costes</h4>
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 z-0" />

            <div className="relative z-10 h-full">
                <ResponsiveContainer width="100%" height="90%" minWidth={0}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number | undefined) => [formatEuro(Number(value || 0)), '']}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', padding: '8px 12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value: string) => <span className="text-slate-600 font-medium ml-1">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
