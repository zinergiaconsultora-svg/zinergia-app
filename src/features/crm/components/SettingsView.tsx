'use client';

import React, { useState, useCallback } from 'react';
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
    Info
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { crmService } from '@/services/crmService';

export default function SettingsView() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'commercial' | 'network'>('profile');

    // Mock initial state
    const [settings, setSettings] = useState({
        companyName: 'Zinergia Central',
        nif: 'B12345678',
        address: 'Calle Principal, 1',
        defaultMargin: 2.5,
        defaultVat: 21,
        logoUrl: null as string | null
    });

    // Mock Network Data (for Admin view)
    const [network] = useState([
        { id: 1, name: 'Franquicia Madrid Norte', type: 'franchise', owner: 'Juan Pérez', royalty: 10, collaborators: 5, status: 'active' },
        { id: 2, name: 'Franquicia Barcelona', type: 'franchise', owner: 'Ana Garcia', royalty: 12, collaborators: 3, status: 'active' },
        { id: 3, name: 'Pedro Colaborador', type: 'collaborator', owner: 'Pedro Lopez', commission: 50, sales: 12, status: 'active' }, // Direct collaborator of Admin
        { id: 2, name: 'Franquicia Barcelona', type: 'franchise', owner: 'Ana Garcia', royalty: 12, collaborators: 3, status: 'active' },
        { id: 3, name: 'Pedro Colaborador', type: 'collaborator', owner: 'Pedro Lopez', commission: 50, sales: 12, status: 'active' }, // Direct collaborator of Admin
    ]);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const extractedData = await crmService.analyzeDocument(file);
            console.log('Extracted Data:', extractedData);

            if (extractedData) {
                setSettings(prev => ({
                    ...prev,
                    companyName: extractedData.company_name || extractedData.client_name || prev.companyName,
                    nif: extractedData.dni_cif || prev.nif,
                    address: extractedData.supply_address || prev.address
                }));
                // TODO: Show success toast
            }
        } catch (error) {
            console.error('Upload failed:', error);
            // TODO: Show error toast
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSave = useCallback(async () => {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLoading(false);
        // TODO: Show toast success
    }, []);

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
                        </div>

                        {activeTab !== 'network' && (
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-energy-600 text-white rounded-xl font-bold hover:bg-energy-700 transition-all shadow-lg shadow-energy-500/30 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ml-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                Guardar
                            </button>
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
                                        <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 group-hover:bg-energy-600 group-hover:shadow-energy-600/30 transition-all">
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
                                            <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 group-hover:bg-energy-600 group-hover:shadow-energy-600/30 transition-all pointer-events-none">
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
                            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
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
                                    {network.map((node) => (
                                        <tr key={node.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${node.type === 'franchise' ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
                                                        {node.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{node.name}</p>
                                                        <p className="text-xs text-slate-400">{node.owner}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${node.type === 'franchise'
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    }`}>
                                                    {node.type === 'franchise' ? 'Franquicia' : 'Colaborador'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-slate-600">
                                                    {node.type === 'franchise' ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">Retiene {100 - (node.royalty || 0)}%</span>
                                                                <span className="text-xs text-slate-400">/</span>
                                                                <span className="text-xs font-bold text-slate-600">Tú {node.royalty || 0}%</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400">Canon Entrada: 3.000€</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Retiene {node.commission || 0}%</span>
                                                                <span className="text-xs text-slate-400">/</span>
                                                                <span className="text-xs font-bold text-slate-600">Tú {100 - (node.commission || 0)}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {node.type === 'franchise' && (
                                                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                                                        <Users size={14} />
                                                        <span>{node.collaborators} colabs</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="Ver opciones">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

            </motion.div>
        </div>
    );
}
