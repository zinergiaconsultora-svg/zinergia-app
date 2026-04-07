import React, { useState, useEffect, useMemo } from 'react';
import { NetworkOverview } from './NetworkOverview';
import { NetworkTree } from './NetworkTree';
import { InviteModal } from './InviteModal';
import { MapView } from './MapView';
import { NetworkIntelligence } from './NetworkIntelligence';
import { crmService } from '@/services/crmService';
import { NetworkUser } from '@/types/crm';
import { UserPlus, RefreshCw, Layers, Map as MapIcon, GitBranch, BrainCircuit, Search, Building2, Users } from 'lucide-react';

export const ManageNetworkView: React.FC = () => {
    const [hierarchy, setHierarchy] = useState<NetworkUser[]>([]);
    const [netStats, setNetStats] = useState({ totalVolumen: 0, monthlyGrowth: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'franchise' | 'agent'>('all');
    const [error, setError] = useState<string | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'tree' | 'map' | 'intel'>('tree');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [hData, sData] = await Promise.all([
                crmService.getNetworkHierarchy(),
                crmService.getNetworkStats()
            ]);
            setHierarchy(hData);
            setNetStats(sData);
       } catch (err: unknown) {
    console.error('Network View Error Details:', err);
    setError(err instanceof Error ? err.message : 'Error al cargar la red jerárquica');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Flatten all nodes recursively for accurate counts
    const flattenNodes = (nodes: NetworkUser[]): NetworkUser[] =>
        nodes.flatMap(n => [n, ...flattenNodes(n.children || [])]);

    const stats = useMemo(() => {
        const all = flattenNodes(hierarchy);
        return {
            totalAgents: all.filter(n => n.role === 'agent').length,
            activeFranchises: all.filter(n => n.role === 'franchise').length,
            totalVolumen: netStats.totalVolumen,
            monthlyGrowth: netStats.monthlyGrowth,
        };
    }, [hierarchy, netStats]);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Mi Red</h1>
                    <p className="text-slate-500 flex items-center gap-2 font-light">
                        <Layers size={16} />
                        Gestión jerárquica de franquicias y colaboradores
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"
                        title="Actualizar datos"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        <UserPlus size={20} />
                        <span className="hidden sm:inline">Invitar a la Red</span>
                    </button>
                </div>
            </div>

            <NetworkOverview stats={stats} />

            <InviteModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
            />

            <div className="mt-8 md:mt-12">
                {/* Tab Navigation - Scrollable on mobile */}
                <div className="flex items-center gap-2 mb-6 md:mb-8 overflow-x-auto pb-4 md:pb-0 no-scrollbar snap-x">
                    <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200/50 w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('tree')}
                            className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-2xl font-medium transition-all flex-1 md:flex-none whitespace-nowrap snap-center ${activeTab === 'tree'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <GitBranch size={16} />
                            Estructura
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-2xl font-medium transition-all flex-1 md:flex-none whitespace-nowrap snap-center ${activeTab === 'map'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <MapIcon size={16} />
                            Mapa
                        </button>
                        <button
                            onClick={() => setActiveTab('intel')}
                            className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-2xl font-medium transition-all flex-1 md:flex-none whitespace-nowrap snap-center ${activeTab === 'intel'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <BrainCircuit size={16} />
                            Inteligencia
                        </button>
                    </div>
                </div>

                <div className="min-h-[500px]">
                    {activeTab === 'tree' ? (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8">
                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Organigrama de Red</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Estructura jerárquica de tu equipo</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nombre o email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all w-56"
                                        />
                                    </div>

                                    {/* Role filters */}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter(roleFilter === 'franchise' ? 'all' : 'franchise')}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${roleFilter === 'franchise'
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                                            }`}
                                        >
                                            <Building2 size={13} /> Franquicia
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoleFilter(roleFilter === 'agent' ? 'all' : 'agent')}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${roleFilter === 'agent'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-emerald-200 hover:text-emerald-600'
                                            }`}
                                        >
                                            <Users size={13} /> Colaborador
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-slate-100 mb-6" />

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm text-slate-400">Cargando red...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                                        <Search size={20} className="text-red-400" />
                                    </div>
                                    <p className="text-sm font-semibold text-red-500 mb-1">Error al cargar</p>
                                    <p className="text-xs text-slate-400 max-w-xs">{error}</p>
                                    <button type="button" onClick={loadData} className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors">
                                        Reintentar
                                    </button>
                                </div>
                            ) : (
                                <NetworkTree
                                    data={hierarchy}
                                    searchTerm={searchTerm}
                                    roleFilter={roleFilter}
                                    onInvite={() => setIsInviteModalOpen(true)}
                                />
                            )}
                        </div>
                    ) : activeTab === 'map' ? (
                        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 rounded-[2.5rem] p-8">
                            <MapView />
                        </div>
                    ) : (
                        <NetworkIntelligence />
                    )}
                </div>
            </div>
        </div>
    );
};
