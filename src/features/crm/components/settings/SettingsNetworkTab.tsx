'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Shield, TrendingUp, Users, MoreVertical } from 'lucide-react';
import { DashboardCard } from '../DashboardCard';
import { crmService } from '@/services/crmService';
import { NetworkUser } from '@/types/crm';

export function SettingsNetworkTab() {
    const [networkNodes, setNetworkNodes] = useState<NetworkUser[]>([]);
    const [networkLoading, setNetworkLoading] = useState(false);

    useEffect(() => {
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
    }, []);

    return (
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
    );
}
