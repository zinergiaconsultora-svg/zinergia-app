'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    Building2,
    Upload,
    Save,
    CreditCard,
    Network,
    Plus,
    Shield,
    Users,
    MoreVertical,
    FileText,
    TrendingUp,
    Lock,
    Info,
    Percent
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { crmService } from '@/services/crmService';
import { saveCommissionRule } from '@/app/actions/commissionRules';
import { saveProfileSettingsAction } from '@/app/actions/profile';
import { CommissionRule, NetworkUser } from '@/types/crm';

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

    // Mock initial state
    const [settings, setSettings] = useState({
        companyName: 'Zinergia Central',
        nif: 'B12345678',
        address: 'Calle Principal, 1',
        defaultMargin: 2.5,
        defaultVat: 21,
        logoUrl: null as string | null
    });

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
            const extractedData = await crmService.analyzeDocument(file);
            if (extractedData) {
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

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
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
                {/* HEADLER */}
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

                    <div className="flex items-center gap-3">
                        {/* Tab Switcher */}
                        <div className="bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-white/40 flex items-center shadow-sm">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'profile'
                                    ? 'bg-white text-energy-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                <Building2 size={16} />
                                Perfil
                            </button>
                            <button
                                onClick={() => setActiveTab('commercial')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'commercial'
                                    ? 'bg-white text-energy-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                <FileText size={16} />
                                Operativa
                            </button>
                            <button
                                onClick={() => setActiveTab('network')}
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
                                    onClick={() => setActiveTab('commissions')}
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
                                    onClick={handleSave}
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
                </div>

                {/* TAB 1: PROFILE */}
                {activeTab === 'profile' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="grid grid-cols-1 md:grid-cols-12 gap-6"
                    >
                        {/* LEFT COLUMN: CONTEXT */}
                        <div className="col-span-1 md:col-span-4 space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800 shadow-sm">
                                <p className="font-bold flex items-center gap-2 mb-3 text-base">
                                    <Shield size={18} />
                                    Identidad Verificada
                                </p>
                                <p className="opacity-90 leading-relaxed mb-4">
                                    Para operar con la Central y emitir facturas, necesitamos validar tu identidad fiscal.
                                </p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-blue-700/80">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span>Sube tu CIF o Modelo 036</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-blue-700/80">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span>DNI del Administrador</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-blue-700/80">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span>Escrituras (si aplica)</span>
                                    </div>
                                </div>
                            </div>

                            <DashboardCard
                                title="Estado de Validación"
                                icon={Shield}
                                className="h-auto"
                            >
                                <div className="mt-2 flex flex-col items-center text-center p-2">
                                    <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3">
                                        <Info size={32} />
                                    </div>
                                    <p className="font-bold text-slate-800">Pendiente de Documentación</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                                        Sube los archivos requeridos para activar tu *Wallet* de comisiones.
                                    </p>
                                </div>
                            </DashboardCard>
                        </div>

                        {/* RIGHT COLUMN: DOCUMENT UPLOAD */}
                        <div className="col-span-1 md:col-span-8 space-y-6">
                            <DashboardCard
                                title="Documentación Fiscal"
                                icon={FileText}
                                subtitle="Sube tus archivos para extracción automática de datos"
                                className="h-auto"
                            >
                                <div className="space-y-6 mt-2">
                                    {/* UPLOAD ZONE */}
                                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/50 hover:bg-white hover:border-energy-400 hover:shadow-lg hover:shadow-energy-500/10 transition-all cursor-pointer group flex flex-col items-center justify-center text-center">
                                        <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                            <Upload size={32} className="text-slate-400 group-hover:text-energy-600 transition-colors" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-700 mb-1 group-hover:text-energy-700 transition-colors">
                                            Arrastra tus documentos aquí
                                        </h4>
                                        <p className="text-sm text-slate-400 mb-6 max-w-sm">
                                            Aceptamos PDF, JPG o PNG. Nuestro sistema procesará la imagen para extraer Razón Social, NIF y Dirección automáticamente.
                                        </p>
                                        <button type="button" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 group-hover:bg-energy-600 group-hover:shadow-energy-600/30 transition-all">
                                            Seleccionar Archivos
                                        </button>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleFileUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                title="Elegir archivo"
                                                aria-label="Subir documento para extracción de datos"
                                            />
                                            <button type="button" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 group-hover:bg-energy-600 group-hover:shadow-energy-600/30 transition-all pointer-events-none">
                                                {loading ? 'Procesando...' : 'Seleccionar Archivos'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* EXTRACTED DATA PREVIEW */}
                                    {settings.nif !== 'B12345678' && (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
                                            <h5 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                                <TrendingUp size={16} />
                                                Datos Extraídos
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-xs text-emerald-600 block">Razón Social</span>
                                                    <span className="font-bold text-emerald-900">{settings.companyName}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-emerald-600 block">NIF/CIF</span>
                                                    <span className="font-bold text-emerald-900">{settings.nif}</span>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <span className="text-xs text-emerald-600 block">Dirección Fiscal</span>
                                                    <span className="font-bold text-emerald-900">{settings.address}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SEPARATION OF ROLES / MOCKED LIST */}
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                            <Building2 size={16} className="text-slate-400" />
                                            Documentos Subidos
                                        </h5>
                                        <div className="space-y-3">
                                            {/* Empty State Mock */}
                                            <div className="p-4 bg-white border border-slate-100 rounded-xl flex items-center gap-4 opacity-60">
                                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="h-2 w-32 bg-slate-100 rounded mb-2" />
                                                    <div className="h-2 w-20 bg-slate-50 rounded" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DashboardCard>
                        </div>
                    </motion.div>
                )}

                {/* TAB 2: COMMERCIAL & LEGAL */}
                {activeTab === 'commercial' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="grid grid-cols-1 md:grid-cols-12 gap-6"
                    >
                        {/* LEFT: PREVIEW */}
                        <div className="col-span-1 md:col-span-4">
                            <div className="bg-slate-900 rounded-3xl p-6 text-white h-full relative overflow-hidden shadow-xl min-h-[400px]">
                                <div className="relative z-10">
                                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                        <FileText size={18} className="text-energy-400" />
                                        Previsualización PDF
                                    </h3>
                                    <p className="text-slate-400 text-sm mb-6 max-w-[30ch]">
                                        Así aparecerán tus textos legales al pie de cada contrato generado.
                                    </p>

                                    <div className="bg-white rounded-lg p-4 shadow-lg text-slate-300 scale-90 origin-top-left border-4 border-slate-800">
                                        <div className="space-y-4 mb-8">
                                            <div className="w-full h-2 bg-slate-100 rounded" />
                                            <div className="w-3/4 h-2 bg-slate-100 rounded" />
                                            <div className="w-1/2 h-2 bg-slate-100 rounded" />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <p className="text-[10px] text-slate-500 font-bold mb-1">CLÁUSULA RGPD:</p>
                                            <p className="text-[8px] text-slate-400 leading-relaxed text-justify">
                                                En cumplimiento de la normativa vigente... sus datos serán tratados por <strong>{settings.companyName}</strong> con la finalidad de...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {/* Decoding circle bg */}
                                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-energy-500/20 rounded-full blur-3xl" />
                            </div>
                        </div>

                        {/* RIGHT: CONFIG */}
                        <div className="col-span-1 md:col-span-8 space-y-6">
                            <DashboardCard
                                title="Condiciones Económicas (Defecto)"
                                icon={CreditCard}
                                subtitle="Valores iniciales para nuevas ofertas"
                                className="h-auto"
                            >
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Margen Comercial (€/kWh)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                id="margin-input"
                                                aria-label="Margen Comercial"
                                                value={settings.defaultMargin}
                                                onChange={(e) => setSettings({ ...settings, defaultMargin: parseFloat(e.target.value) })}
                                                className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-200 focus:border-energy-500 outline-none font-bold text-lg"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="vat-select" className="text-sm font-bold text-slate-700">IVA Aplicable</label>
                                            <select
                                                id="vat-select"
                                                aria-label="IVA Aplicable"
                                                value={settings.defaultVat}
                                                onChange={(e) => setSettings({ ...settings, defaultVat: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-energy-500 outline-none font-bold"
                                            >
                                                <option value={21}>21%</option>
                                                <option value={10}>10%</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </DashboardCard>

                            <DashboardCard
                                title="Textos Legales y RGPD"
                                icon={Lock}
                                subtitle="Configura la letra pequeña de tus contratos"
                                className="h-auto"
                            >
                                <div className="mt-2 text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p>💡 <strong>¿Para qué sirve esto?</strong> Este texto se añade automáticamente al final de todos los PDFs de ofertas y contratos para cumplir con la Ley de Protección de Datos.</p>
                                </div>
                                <textarea
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-energy-500 outline-none transition-all text-sm h-32 resize-y font-mono text-slate-600 leading-relaxed"
                                    placeholder="Escribe aquí tu cláusula legal..."
                                    defaultValue="En cumplimiento del Reglamento (UE) 2016/679..."
                                />
                            </DashboardCard>
                        </div>
                    </motion.div>
                )}

                {/* TAB 3: NETWORK */}
                {activeTab === 'network' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Configuración de Comisiones</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Define cuánto gana cada tipo de socio por captación.
                                    <br />
                                    <span className="text-xs text-slate-400 mt-1 inline-block">
                                        Ejemplo base: Captación de 100€
                                    </span>
                                </p>
                            </div>
                            <button type="button" className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
                                <Plus size={16} />
                                Nueva Entidad
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* RAPEL INCENTIVES CARD */}
                            <div className="col-span-1 md:col-span-3">
                                <DashboardCard
                                    title="Rápeles e Incentivos"
                                    icon={TrendingUp}
                                    subtitle="Automatiza la motivación de tu red"
                                    className="h-auto bg-gradient-to-r from-white to-orange-50/50"
                                >
                                    <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
                                        <div className="flex-1 w-full space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                <span className="text-sm font-bold text-slate-700">Nivel Bronce</span>
                                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">0 - 10 Ventas</span>
                                                <span className="text-sm font-bold text-slate-900">Base</span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-white rounded-xl border-l-4 border-l-orange-500 border-y border-r border-slate-200 shadow-sm relative overflow-hidden">
                                                <div className="absolute inset-0 bg-orange-50/20 pointer-events-none" />
                                                <span className="text-sm font-bold text-orange-700">Nivel Oro</span>
                                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">+20 Ventas</span>
                                                <span className="text-sm font-bold text-orange-700">+5% Extra</span>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-auto p-4 bg-orange-100 rounded-2xl flex flex-col items-center text-center">
                                            <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center mb-2 shadow-lg shadow-orange-500/30">
                                                <TrendingUp size={20} />
                                            </div>
                                            <p className="text-xs font-bold text-orange-800">Incentivo Activo</p>
                                            <p className="text-[10px] text-orange-600 max-w-[120px] leading-tight mt-1">
                                                Tus franquicias ganan más si venden más.
                                            </p>
                                        </div>
                                    </div>
                                </DashboardCard>
                            </div>

                            {/* Example Card: HQ Direct */}
                            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <Shield size={64} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Venta Directa (Tú)</p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-bold">100%</p>
                                    <span className="text-sm text-slate-400">comisión</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Si captas tú: <strong>100€</strong> para ti.
                                </p>
                            </div>

                            {/* Example Card: Franchise */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Venta Franquicia</p>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-3xl font-bold text-indigo-600">80%</p>
                                        <span className="text-sm text-slate-400">para ellos</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                                    Si captan ellos: <strong>80€</strong> ellos, <strong>20€</strong> tú.
                                </p>
                            </div>

                            {/* Example Card: Collaborator */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Venta Colaborador</p>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-3xl font-bold text-emerald-600">50%</p>
                                        <span className="text-sm text-slate-400">para ellos</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                                    Si captan ellos: <strong>50€</strong> ellos, <strong>50€</strong> tú.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 font-bold tracking-wider">
                                        <th className="px-6 py-4">Entidad</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4">Modelo Económico</th>
                                        <th className="px-6 py-4">Equipo Descendiente</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {networkLoading && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                                                Cargando red...
                                            </td>
                                        </tr>
                                    )}
                                    {!networkLoading && networkNodes.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                                                No hay entidades en tu red todavía.
                                            </td>
                                        </tr>
                                    )}
                                    {networkNodes.map((node) => {
                                        const isFranchise = node.role === 'franchise';
                                        const royalty = node.franchise_config?.royalty_percent ?? 0;
                                        const childCount = (node.children || []).length;
                                        return (
                                            <tr key={node.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${isFranchise ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
                                                            {node.full_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-sm">{node.franchise_config?.company_name || node.full_name}</p>
                                                            <p className="text-xs text-slate-400">{node.full_name}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${isFranchise
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        }`}>
                                                        {isFranchise ? 'Franquicia' : 'Colaborador'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">
                                                        {isFranchise ? (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">Retiene {100 - royalty}%</span>
                                                                    <span className="text-xs text-slate-400">/</span>
                                                                    <span className="text-xs font-bold text-slate-600">Tú {royalty}%</span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-400">Canon Entrada: 3.000€</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">Según regla activa</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isFranchise && childCount > 0 && (
                                                        <div className="flex items-center gap-1 text-slate-500 text-sm">
                                                            <Users size={14} />
                                                            <span>{childCount} colabs</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button type="button" className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="Ver opciones">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* COMMISSIONS TAB */}
                {activeTab === 'commissions' && canManageCommissions && (
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
                                                            value={ruleForm[key as keyof typeof ruleForm]}
                                                            onChange={e => setRuleForm(f => ({ ...f, [key]: e.target.value }))}
                                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Live sum indicator */}
                                        {(() => {
                                            const sum = parseFloat(ruleForm.agent_share || '0') + parseFloat(ruleForm.franchise_share || '0') + parseFloat(ruleForm.hq_share || '0');
                                            const ok = Math.abs(sum - 100) < 0.1;
                                            return (
                                                <p className={`text-xs mt-2 font-bold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    Total: {sum.toFixed(1)}% {ok ? '✓' : '— debe ser 100%'}
                                                </p>
                                            );
                                        })()}
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
                )}

            </motion.div>
        </div>
    );
}
