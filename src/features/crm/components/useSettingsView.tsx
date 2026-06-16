'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { crmService } from '@/services/crmService';
import { saveCommissionRule } from '@/app/actions/commissionRules';
import { saveProfileSettingsAction, getProfileSettingsAction } from '@/app/actions/profile';
import { CommissionRule, NetworkUser } from '@/types/crm';

type ActiveRule = (Omit<CommissionRule, 'id' | 'created_at' | 'effective_from'> & { id?: string }) | null;

export function useSettingsView(activeCommissionRule: ActiveRule) {
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'fiscal' | 'commercial' | 'network' | 'commissions'>('profile');

    const [settings, setSettings] = useState({
        companyName: '',
        nif: '',
        address: '',
        defaultMargin: 2.5,
        defaultVat: 21,
        logoUrl: null as string | null
    });

    useEffect(() => {
        getProfileSettingsAction()
            .then(data => setSettings(prev => ({ ...prev, ...data })))
            .catch(err => console.error('Error cargando configuración:', err));
    }, []);

    // Commission rule form state (initialized from active rule or defaults)
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

    // Real network data
    const [networkNodes, setNetworkNodes] = useState<NetworkUser[]>([]);
    const [networkLoading, setNetworkLoading] = useState(false);

    useEffect(() => {
        if (activeTab !== 'network') return;
        setNetworkLoading(true);
        crmService.getNetworkHierarchy()
            .then(tree => {
                // Flatten tree: root nodes + their direct children
                const flat: NetworkUser[] = [];
                tree.forEach(root => {
                    flat.push(root);
                    (root.children || []).forEach(child => flat.push(child));
                });
                setNetworkNodes(flat);
            })
            .catch(err => console.error('Error loading network:', err))
            .finally(() => setNetworkLoading(false));
    }, [activeTab]);

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
                    address: extractedData.supply_address || prev.address
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

    return {
        loading, saveSuccess, saveError, activeTab, setActiveTab,
        settings, setSettings, ruleForm, setRuleForm, ruleSaving, ruleSuccess, ruleError,
        handleSaveRule, networkNodes, networkLoading, handleFileUpload, handleSave,
    };
}
