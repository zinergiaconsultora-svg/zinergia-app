'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Percent, Save, TrendingUp } from 'lucide-react';
import { DashboardCard } from '../DashboardCard';
import { CommissionRule } from '@/types/crm';

interface RuleForm {
    name: string;
    commission_rate: string;
    agent_share: string;
    franchise_share: string;
    hq_share: string;
    points_per_win: string;
}

interface SettingsCommissionsTabProps {
    ruleForm: RuleForm;
    setRuleForm: React.Dispatch<React.SetStateAction<RuleForm>>;
    ruleSaving: boolean;
    ruleSuccess: boolean;
    ruleError: string | null;
    handleSaveRule: () => void;
    commissionRulesHistory: CommissionRule[];
}

export function SettingsCommissionsTab({
    ruleForm,
    setRuleForm,
    ruleSaving,
    ruleSuccess,
    ruleError,
    handleSaveRule,
    commissionRulesHistory,
}: SettingsCommissionsTabProps) {
    const shareSum =
        parseFloat(ruleForm.agent_share || '0') +
        parseFloat(ruleForm.franchise_share || '0') +
        parseFloat(ruleForm.hq_share || '0');
    const shareSumOk = Math.abs(shareSum - 100) < 0.1;

    return (
        <motion.div key="commissions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <DashboardCard title="Regla de Comisiones Activa" icon={Percent}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <Percent size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Regla de Comisiones Activa</h2>
                            <p className="text-sm text-slate-500">Los cambios aplican a nuevas propuestas aceptadas. Las comisiones ya calculadas no se modifican.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nombre de la regla</label>
                            <input
                                type="text"
                                value={ruleForm.name}
                                onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ej. Regla Q1 2026"
                            />
                        </div>

                        <div>
                            <label htmlFor="commission_rate" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                                % sobre ahorro anual (pot)
                            </label>
                            <div className="relative">
                                <input
                                    id="commission_rate"
                                    type="number" min="1" max="100" step="0.1"
                                    value={ruleForm.commission_rate}
                                    onChange={e => setRuleForm(f => ({ ...f, commission_rate: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Porcentaje del ahorro anual que forma el bote de comisión</p>
                        </div>

                        <div>
                            <label htmlFor="points_per_win" className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Puntos por venta ganada</label>
                            <input
                                id="points_per_win"
                                type="number" min="0"
                                value={ruleForm.points_per_win}
                                onChange={e => setRuleForm(f => ({ ...f, points_per_win: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <p className="text-xs font-bold text-slate-600 uppercase mb-3">Reparto del bote (debe sumar 100%)</p>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { key: 'agent_share', label: 'Agente' },
                                    { key: 'franchise_share', label: 'Franquicia' },
                                    { key: 'hq_share', label: 'HQ' },
                                ].map(({ key, label }) => (
                                    <div key={key}>
                                        <label htmlFor={key} className="block text-xs text-slate-500 mb-1.5">{label}</label>
                                        <div className="relative">
                                            <input
                                                id={key}
                                                type="number" min="0" max="100" step="0.1"
                                                value={ruleForm[key as keyof RuleForm]}
                                                onChange={e => setRuleForm(f => ({ ...f, [key]: e.target.value }))}
                                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className={`text-xs mt-2 font-bold ${shareSumOk ? 'text-emerald-600' : 'text-rose-600'}`}>
                                Total: {shareSum.toFixed(1)}% {shareSumOk ? '✓' : '— debe ser 100%'}
                            </p>
                        </div>
                    </div>

                    {ruleError && (
                        <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">{ruleError}</div>
                    )}
                    {ruleSuccess && (
                        <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">✓ Regla guardada correctamente. Aplica a las siguientes propuestas aceptadas.</div>
                    )}

                    <button
                        type="button"
                        onClick={handleSaveRule}
                        disabled={ruleSaving}
                        className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {ruleSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                        {ruleSaving ? 'Guardando…' : 'Guardar nueva regla'}
                    </button>
                </div>
            </DashboardCard>

            {commissionRulesHistory.length > 0 && (
                <DashboardCard title="Historial de reglas" icon={TrendingUp}>
                    <div className="p-6">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">Historial de reglas</h3>
                        <div className="space-y-2">
                            {commissionRulesHistory.map(rule => (
                                <div key={rule.id} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${rule.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div>
                                        <span className="font-bold text-slate-800">{rule.name}</span>
                                        <span className="ml-2 text-xs text-slate-400">{new Date(rule.effective_from).toLocaleDateString('es-ES')}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span>Pot: {(rule.commission_rate * 100).toFixed(1)}%</span>
                                        <span>Agente: {(rule.agent_share * 100).toFixed(0)}%</span>
                                        {rule.is_active && <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Activa</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DashboardCard>
            )}
        </motion.div>
    );
}
