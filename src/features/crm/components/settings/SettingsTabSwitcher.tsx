'use client';

import React from 'react';
import { Building2, FileText, Network, Percent, Save } from 'lucide-react';

interface SettingsTabSwitcherProps {
    activeTab: 'profile' | 'commercial' | 'network' | 'commissions';
    onTabChange: (tab: 'profile' | 'commercial' | 'network' | 'commissions') => void;
    canManageCommissions: boolean;
    loading: boolean;
    saveSuccess: boolean;
    saveError: string | null;
    onSave: () => void;
}

export function SettingsTabSwitcher({
    activeTab,
    onTabChange,
    canManageCommissions,
    loading,
    saveSuccess,
    saveError,
    onSave,
}: SettingsTabSwitcherProps) {
    return (
        <div className="flex items-center gap-3">
            <div className="bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-white/40 flex items-center shadow-sm">
                <button
                    onClick={() => onTabChange('profile')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'profile'
                        ? 'bg-white text-energy-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                >
                    <Building2 size={16} />
                    Perfil
                </button>
                <button
                    onClick={() => onTabChange('commercial')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'commercial'
                        ? 'bg-white text-energy-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                >
                    <FileText size={16} />
                    Operativa
                </button>
                <button
                    onClick={() => onTabChange('network')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'network'
                        ? 'bg-white text-energy-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                >
                    <Network size={16} />
                    Red
                </button>
                {canManageCommissions && (
                    <button
                        type="button"
                        onClick={() => onTabChange('commissions')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'commissions'
                            ? 'bg-white text-energy-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                    >
                        <Percent size={16} />
                        Comisiones
                    </button>
                )}
            </div>

            {activeTab !== 'network' && activeTab !== 'commissions' && (
                <div className="flex items-center gap-3 ml-2">
                    {saveSuccess && (
                        <span className="text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
                            ✓ Guardado
                        </span>
                    )}
                    {saveError && (
                        <span className="text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg animate-in fade-in">
                            {saveError}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-energy-600 text-white rounded-xl font-bold hover:bg-energy-700 transition-all shadow-lg shadow-energy-500/30 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Guardar
                    </button>
                </div>
            )}
        </div>
    );
}
