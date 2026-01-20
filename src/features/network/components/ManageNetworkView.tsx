import React, { useState, useEffect } from 'react';
import { NetworkOverview } from './NetworkOverview';
import { NetworkTree } from './NetworkTree';
import { InviteModal } from './InviteModal';
import { MapView } from './MapView';
import { NetworkIntelligence } from './NetworkIntelligence';
import { crmService } from '@/services/crmService';
import { NetworkUser } from '@/types/crm';
import { UserPlus, RefreshCw, Layers, Map as MapIcon, GitBranch, BrainCircuit, Search } from 'lucide-react';

export const ManageNetworkView: React.FC = () => {
    const [hierarchy, setHierarchy] = useState<NetworkUser[]>([]);
    const [netStats, setNetStats] = useState({ totalVolumen: 0, monthlyGrowth: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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
        } catch (err: any) {
            console.error('Network View Error Details:', err);
            setError(err.message || 'Error al cargar la red jerárquica');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const stats = {
        totalAgents: hierarchy.reduce((acc: number, curr: NetworkUser) => acc + (curr.children?.length || 0) + 1, 0),
        activeFranchises: hierarchy.filter((n: NetworkUser) => n.role === 'franchise').length,
        totalVolumen: netStats.totalVolumen,
        monthlyGrowth: netStats.monthlyGrowth
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Mi Red &quot;Nexus&quot;</h1>
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
                        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 rounded-[2.5rem] p-8">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                                <h2 className="text-xl font-bold text-slate-900">Organigrama de Red</h2>

                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="relative group flex-1 md:flex-none">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar agente..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden lg:flex">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                            Franquicia
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                                            Colaborador
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center p-20">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : error ? (
                                <div className="text-red-500 text-center py-12 bg-red-50 rounded-3xl border border-red-100">
                                    {error}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    <NetworkTree
                                        data={hierarchy}
                                        searchTerm={searchTerm}
                                        onInvite={() => setIsInviteModalOpen(true)}
                                    />
                                    {hierarchy.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 font-light italic">
                                            No hay niveles registrados en tu red todavía. Empieza invitando a alguien.
                                        </div>
                                    )}
                                </div>
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
