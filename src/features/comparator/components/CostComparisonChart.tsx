'use client';

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface CostComparisonProps {
    currentCost: number;
    offerCost: number;
}

export const CostComparisonChart: React.FC<CostComparisonProps> = ({ currentCost, offerCost }) => {
    const data = [
        {
            name: 'Coste Anual',
            Actual: currentCost,
            Propuesta: offerCost,
        },
    ];

    const formatEuro = (value: number) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

    return (
        <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-4 text-center">Comparativa Anual Estimada</h4>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `€${val}`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                        formatter={(value: number | undefined) => [formatEuro(Number(value) || 0), '']}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'transparent' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Actual" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={60} name="Coste Actual (Est.)" />
                    <Bar dataKey="Propuesta" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={60} name="Con Zinergia" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
