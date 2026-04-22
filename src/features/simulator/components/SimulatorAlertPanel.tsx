'use client';

import React from 'react';
import { AlertTriangle, ChevronDown, Sparkles, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlertItem {
    type: 'info' | 'warning' | 'error' | 'success' | 'learned';
    message: React.ReactNode;
    action?: React.ReactNode;
}

interface SimulatorAlertPanelProps {
    alerts: AlertItem[];
    expanded: boolean;
    onToggle: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_COLORS: Record<AlertItem['type'], { bg: string; icon: string; text: string }> = {
    info:    { bg: 'bg-indigo-50 border-indigo-200',    icon: 'text-indigo-500',  text: 'text-indigo-800' },
    warning: { bg: 'bg-amber-50 border-amber-200',      icon: 'text-amber-500',   text: 'text-amber-800' },
    error:   { bg: 'bg-red-50 border-red-200',          icon: 'text-red-500',     text: 'text-red-800' },
    success: { bg: 'bg-emerald-50 border-emerald-200',  icon: 'text-emerald-500', text: 'text-emerald-800' },
    learned: { bg: 'bg-emerald-50 border-emerald-200',  icon: 'text-emerald-500', text: 'text-emerald-800' },
};

// ── Component ─────────────────────────────────────────────────────────────────

const SimulatorAlertPanel: React.FC<SimulatorAlertPanelProps> = ({ alerts, expanded, onToggle }) => {
    if (alerts.length === 0) return null;

    const hasErrors = alerts.some(a => a.type === 'error');
    const hasWarnings = alerts.some(a => a.type === 'warning');

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6"
            >
                <div className={`rounded-2xl border overflow-hidden ${
                    hasErrors ? 'border-red-200 bg-red-50/50'
                    : hasWarnings ? 'border-amber-200 bg-amber-50/30'
                    : 'border-slate-200 bg-white/50'
                }`}>
                    {/* Panel header */}
                    <button type="button" onClick={onToggle}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={13} className={hasErrors ? 'text-red-500' : hasWarnings ? 'text-amber-500' : 'text-slate-400'} />
                            <span className="text-xs font-bold text-slate-600">
                                {alerts.length} aviso{alerts.length > 1 ? 's' : ''} del análisis
                            </span>
                            {alerts.some(a => a.type === 'learned') && (
                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-1.5 py-px rounded-full">
                                    <Sparkles size={8} /> Aprendido
                                </span>
                            )}
                        </div>
                        <ChevronDown size={13} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Alert rows */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="border-t border-black/5 divide-y divide-black/5">
                                    {alerts.map((alert, i) => {
                                        const c = ALERT_COLORS[alert.type];
                                        const Icon = alert.type === 'error' ? AlertTriangle
                                            : alert.type === 'learned' ? Sparkles
                                            : alert.type === 'info' ? Activity
                                            : AlertTriangle;
                                        return (
                                            <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 ${c.bg}`}>
                                                <Icon size={12} className={`${c.icon} shrink-0`} />
                                                <p className={`text-xs flex-1 ${c.text}`}>{alert.message}</p>
                                                {alert.action}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SimulatorAlertPanel;
