import React from 'react';
import { InvoiceData } from '../../../types/crm';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ConsumptionChartProps {
    data: InvoiceData;
}

export const ConsumptionChart: React.FC<ConsumptionChartProps> = ({ data }) => {
    const chartData = [
        { name: 'P1', consumo: data.energy_p1 || 0 },
        { name: 'P2', consumo: data.energy_p2 || 0 },
        { name: 'P3', consumo: data.energy_p3 || 0 },
        { name: 'P4', consumo: data.energy_p4 || 0 },
        { name: 'P5', consumo: data.energy_p5 || 0 },
        { name: 'P6', consumo: data.energy_p6 || 0 },
    ];

    return (
        <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="consumoGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }}
                        contentStyle={{
                            borderRadius: '16px',
                            border: 'none',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            padding: '12px'
                        }}
                        itemStyle={{ color: '#4338ca', fontWeight: 'bold' }}
                    />
                    <Bar
                        dataKey="consumo"
                        fill="url(#consumoGradient)"
                        radius={[6, 6, 6, 6]}
                        animationDuration={1500}
                        barSize={32}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
