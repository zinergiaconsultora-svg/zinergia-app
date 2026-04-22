'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { saveCommissionRule } from '@/app/actions/commissionRules';
import { saveProfileSettingsAction, getProfileSettingsAction } from '@/app/actions/profile';
import { CommissionRule } from '@/types/crm';
import { SettingsTabSwitcher } from './settings/SettingsTabSwitcher';
import { SettingsProfileTab } from './settings/SettingsProfileTab';
import { SettingsCommercialTab } from './settings/SettingsCommercialTab';
import { SettingsNetworkTab } from './settings/SettingsNetworkTab';
import { SettingsCommissionsTab } from './settings/SettingsCommissionsTab';

interface SettingsViewProps {
    canManageCommissions?: boolean;
    activeCommissionRule?: Omit<CommissionRule, 'id' | 'created_at' | 'effective_from'> & { id?: string } | null;
    commissionRulesHistory?: CommissionRule[];
}

export default function SettingsView({
    canManageCommissions = false,
    activeCommissionRule = null,
    commissionRulesHistory = [],
}: SettingsViewProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'commercial' | 'network' | 'commissions'>('profile');

    const [settings, setSettings] = useState({
        companyName: '',
        nif: '',
        address: '',
        defaultMargin: 2.5,
        defaultVat: 21,
        logoUrl: null as string | null,
    });

    useEffect(() => {
        getProfileSettingsAction()
            .then(data => setSettings(prev => ({ ...prev, ...data })))
            .catch(err => console.error('Error cargando configuración:', err));
    }, []);

    const [ruleForm, setRuleForm] = useState({
        name: activeCommissionRule?.name ?? 'Regla por defecto',
        commission_rate: ((activeCommissionRule?.commission_rate ?? 0.15) * 100).toFixed(1),
        agent_share: ((activeCommissionRule?.agent_share ?? 0.30) * 100).toFixed(1),
        franchise_share: ((activeCommissionRule?.franchise_share ?? 0.50) * 100).toFixed(1),
        hq_share: ((activeCommissionRule?.hq_share ?? 0.20) * 100).toFixed(1),
        points_per_win: String(activeCommissionRule?.points_per_win ?? 50),
    });
    const [ruleSaving, setRuleSaving] = useState(false);
    const [ruleSuccess, setRuleSuccess] = useState(false);
    const [ruleError, setRuleError] = useState<string | null>(null);

    const handleSaveRule = async () => {
        setRuleSaving(true);
        setRuleError(null);
        setRuleSuccess(false);
        try {
            await saveCommissionRule({
                name: ruleForm.name,
                commission_rate: parseFloat(ruleForm.commission_rate) / 100,
                agent_share: parseFloat(ruleForm.agent_share) / 100,
                franchise_share: parseFloat(ruleForm.franchise_share) / 100,
                hq_share: parseFloat(ruleForm.hq_share) / 100,
                points_per_win: parseInt(ruleForm.points_per_win, 10),
            });
            setRuleSuccess(true);
            setTimeout(() => setRuleSuccess(false), 3000);
        } catch (err) {
            setRuleError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setRuleSaving(false);
        }
    };

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setSaveError(null);
        try {
            const response = await crmService.analyzeDocument(file);
            if (response && response.data) {
                const extractedData = response.data;
                setSettings(prev => ({
                    ...prev,
                    companyName: extractedData.company_name || extractedData.client_name || prev.companyName,
                    nif: extractedData.dni_cif || prev.nif,
                    address: extractedData.supply_address || prev.address,
                }));
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            setSaveError('Error al procesar el documento');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSave = useCallback(async () => {
        setLoading(true);
        setSaveSuccess(false);
        setSaveError(null);
        try {
            await saveProfileSettingsAction(settings);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setLoading(false);
        }
    }, [settings]);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] pb-12 font-sans text-slate-900 selection:bg-energy-500/30">
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-energy-50/40 via-transparent to-transparent opacity-70" />

            <motion.div
                className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 flex items-center justify-center text-slate-500 hover:text-energy-600 hover:border-energy-200 transition-all shadow-sm hover:shadow-md"
                            title="Volver"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                                Configuración
                            </h1>
                            <p className="text-xs text-slate-500 font-medium tracking-wide">Gestión de perfil y red comercial</p>
                        </div>
                    </div>

                    <SettingsTabSwitcher
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        canManageCommissions={canManageCommissions}
                        loading={loading}
                        saveSuccess={saveSuccess}
                        saveError={saveError}
                        onSave={handleSave}
                    />
                </div>

                {activeTab === 'profile' && (
                    <SettingsProfileTab
                        settings={settings}
                        loading={loading}
                        saveSuccess={saveSuccess}
                        handleFileUpload={handleFileUpload}
                    />
                )}

                {activeTab === 'commercial' && (
                    <SettingsCommercialTab
                        settings={settings}
                        onChangeMargin={(v) => setSettings(prev => ({ ...prev, defaultMargin: v }))}
                        onChangeVat={(v) => setSettings(prev => ({ ...prev, defaultVat: v }))}
                    />
                )}

                {activeTab === 'network' && (
                    <SettingsNetworkTab />
                )}

                {activeTab === 'commissions' && canManageCommissions && (
                    <SettingsCommissionsTab
                        ruleForm={ruleForm}
                        setRuleForm={setRuleForm}
                        ruleSaving={ruleSaving}
                        ruleSuccess={ruleSuccess}
                        ruleError={ruleError}
                        handleSaveRule={handleSaveRule}
                        commissionRulesHistory={commissionRulesHistory}
                    />
                )}
            </motion.div>
        </div>
    );
}
