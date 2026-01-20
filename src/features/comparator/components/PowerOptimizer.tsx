import React, { useEffect, useState } from 'react';
import { InvoiceData } from '../../../types/crm';
import { AlertCircle, CheckCircle2, Sliders } from 'lucide-react';

interface PowerOptimizerProps {
    data: InvoiceData;
    onUpdate: (newData: InvoiceData) => void;
}

export const PowerOptimizer: React.FC<PowerOptimizerProps> = ({ data, onUpdate }) => {
    // Basic logic: If P > 15, suggest optimization (placeholder logic, would be complex in real app)
    // For visual demo, we just show a "Potential Optimization" indicator
    const [animateTotal, setAnimateTotal] = useState(false);
    const totalPower = [1, 2, 3, 4, 5, 6].reduce((acc, i) => acc + (data[`power_p${i}` as keyof InvoiceData] as number || 0), 0);

    // Trigger animation when total power changes
    useEffect(() => {
        // Use a small timeout to decouple the state update from the render cycle (fixes lint warning)
        const startTimer = setTimeout(() => {
            setAnimateTotal(true);
            setTimeout(() => setAnimateTotal(false), 300);
        }, 50);
        return () => clearTimeout(startTimer);
    }, [totalPower]);

    return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map(p => {
                const currentVal = data[`power_p${p}` as keyof InvoiceData] as number || 0;
                const isHigh = currentVal > 15; // Just a dummy threshold for demo

                return (
                    <div key={`opt-p${p}`} className="group relative bg-white hover:bg-slate-50 p-3 rounded-2xl border border-slate-200 hover:border-energy-300 transition-all duration-300 shadow-sm hover:shadow-md">
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                                        P{p}
                                    </label>
                                    {/* Visual slider track hint */}
                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-amber-400' : 'bg-energy-400'}`}
                                            style={{ width: `${Math.min((currentVal / 20) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        value={currentVal}
                                        onChange={(e) => onUpdate({ ...data, [`power_p${p}`]: parseFloat(e.target.value) || 0 })}
                                        className="bg-transparent font-black text-slate-800 border-none p-0 text-xl w-20 focus:ring-0 transition-colors group-hover:text-energy-600"
                                        aria-label={`Potencia P${p}`}
                                    />
                                    <span className="text-xs font-semibold text-slate-400">kW</span>
                                </div>
                            </div>

                            {/* Optimization Indicator */}
                            {isHigh ? (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm animate-pulse-slow">
                                    <AlertCircle size={14} className="fill-amber-100" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Optimizable</span>
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-sm">
                                    <CheckCircle2 size={16} />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Total Power Summary Card */}
            <div className="mt-6 p-4 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-900/10 flex justify-between items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-energy-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Sliders size={18} className="text-energy-300" />
                    </div>
                    <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Contratado</span>
                        <span className="text-xs text-slate-500">Suma de P1-P6</span>
                    </div>
                </div>

                <div className={`relative z-10 text-2xl font-black tracking-tight transition-transform duration-300 ${animateTotal ? 'scale-110 text-energy-300' : 'text-white'}`}>
                    {totalPower.toFixed(2)} <span className="text-sm font-medium text-slate-500">kW</span>
                </div>
            </div>
        </div>
    );
};
