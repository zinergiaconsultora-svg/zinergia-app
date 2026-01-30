'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Zap, Activity } from 'lucide-react';

interface ChartData {
    offer: string;
    annualCost: number;
    savings: number;
    savingsPercent: number;
}

interface SimulatorChartsProps {
    results: any[];
    invoiceData: any;
    history?: any[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const SimulatorCharts: React.FC<SimulatorChartsProps> = ({ results, invoiceData, history }) => {
    // Prepare bar chart data
    const barData: ChartData[] = results.map((r, i) => ({
        offer: r.offer.marketer_name,
        annualCost: r.offer_annual_cost,
        savings: r.annual_savings,
        savingsPercent: r.savings_percent,
    }));

    // Prepare pie chart data for cost breakdown
    const bestOffer = results[0];
    const pieData = [
        { name: 'Potencia', value: calculateAnnualPowerCost(bestOffer) },
        { name: 'Energía', value: calculateAnnualEnergyCost(bestOffer) },
        { name: 'Cuota Fija', value: calculateAnnualFixedFee(bestOffer) },
    ];

    // Prepare trend data from history
    const trendData = history?.slice(0, 6).map((h, i) => ({
        month: new Date(h.created_at).toLocaleDateString('es-ES', { month: 'short' }),
        savings: h.total_savings || 0,
    })) || [];

    return (
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <p className="text-sm text-slate-500">Ahorro Anual</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        €{results[0]?.annual_savings.toFixed(0) || 0}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-500">% Ahorro</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        {results[0]?.savings_percent.toFixed(1) || 0}%
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Zap className="w-5 h-5 text-amber-600" />
                        </div>
                        <p className="text-sm text-slate-500">Costo Anual</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        €{results[0]?.offer_annual_cost.toFixed(0) || 0}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-xl p-6 shadow-sm"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <p className="text-sm text-slate-500">Comparaciones</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        {results.length}
                    </p>
                </motion.div>
            </div>

            {/* Cost Comparison Bar Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl p-6 shadow-sm"
            >
                <h3 className="text-lg font-bold text-slate-900 mb-4">Comparación de Costos</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="offer" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            fontSize={12}
                        />
                        <YAxis 
                            label="€"
                            fontSize={12}
                        />
                                <Tooltip 
                                    formatter={(value: number | undefined) => `€${(value || 0).toFixed(2)}`}
                                    contentStyle={{ 
                                        backgroundColor: '#1f2937',
                                        borderRadius: '8px',
                                        border: 'none'
                                    }}
                                />
                        <Legend />
                        <Bar dataKey="annualCost" fill="#ef4444" name="Costo Anual" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="savings" fill="#10b981" name="Ahorro" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cost Breakdown Pie Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white rounded-xl p-6 shadow-sm"
                >
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Desglose de Costos</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number | undefined) => `€${(value || 0).toFixed(2)}`}
                                contentStyle={{ 
                                    backgroundColor: '#1f2937',
                                    borderRadius: '8px',
                                    border: 'none'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Savings Trend Line Chart */}
                {trendData.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white rounded-xl p-6 shadow-sm"
                    >
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Tendencia de Ahorros</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" fontSize={12} />
                                <YAxis 
                                    label="€"
                                    fontSize={12}
                                />
                                <Tooltip 
                                    formatter={(value: number | undefined) => `€${(value || 0).toFixed(2)}`}
                                    contentStyle={{ 
                                        backgroundColor: '#1f2937',
                                        borderRadius: '8px',
                                        border: 'none'
                                    }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="savings" 
                                    stroke="#10b981" 
                                    strokeWidth={2}
                                    dot={{ fill: '#10b981', r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

// Helper functions
function calculateAnnualPowerCost(offer: any): number {
    const daysPerYear = 365;
    const days = 30; // Default billing period
    
    const powerCost = Object.values(offer.offer.power_price).reduce((sum: number, val: any) => sum + (val || 0), 0);
    return powerCost * (daysPerYear / days);
}

function calculateAnnualEnergyCost(offer: any): number {
    if (!offer || !offer.offer || !offer.offer.energy_price) {
        return 0;
    }

    // Get consumption from invoice data if available
    const energyPrices = offer.offer.energy_price;
    const energyCost = Object.entries(energyPrices).reduce((sum: number, [period, price]) => {
        const periodNum = period.replace('p', '');
        const energyKey = `energy_p${periodNum}` as keyof any;
        const consumption = offer.invoiceData?.[energyKey] || 0;
        return sum + (consumption * (price as number));
    }, 0);

    // Annualize (assuming 30-day billing period)
    return energyCost * (365 / 30);
}

function calculateAnnualFixedFee(offer: any): number {
    return offer.offer.fixed_fee * 12;
}
