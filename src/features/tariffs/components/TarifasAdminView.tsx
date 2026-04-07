'use client'

import { useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Zap, Flame, BadgePercent, ChevronDown } from 'lucide-react'
import { TarifaRow, TariffCommissionRow } from '@/app/actions/tariffs'
import { ElectricityTab } from './ElectricityTab'
import { GasTab } from './GasTab'
import { CommissionsTab } from './CommissionsTab'

type Tab = 'electricity' | 'gas' | 'commissions'

interface Props {
    initialElectricity: TarifaRow[]
    initialGas: TarifaRow[]
    initialCommissions: TariffCommissionRow[]
    initialCollaboratorPct: number
    isAdmin: boolean
}

export default function TarifasAdminView({ initialElectricity, initialGas, initialCommissions, initialCollaboratorPct, isAdmin }: Props) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const rawTab = searchParams.get('tab')
    const tab: Tab = rawTab === 'gas' || rawTab === 'commissions' ? rawTab : 'electricity'
    const setTab = (t: Tab) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', t)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const [electricity, setElectricity] = useState(initialElectricity)
    const [gas, setGas] = useState(initialGas)
    const [commissions, setCommissions] = useState(initialCommissions)
    const [collaboratorPct, setCollaboratorPct] = useState(initialCollaboratorPct)

    const handleElecUpdate = (updated: TarifaRow[], deleted?: string) => {
        setElectricity(deleted ? updated.filter(r => r.id !== deleted) : updated)
    }
    const handleGasUpdate = (updated: TarifaRow[], deleted?: string) => {
        setGas(deleted ? updated.filter(r => r.id !== deleted) : updated)
    }
    const handleCommUpdate = (updated: TariffCommissionRow[], deleted?: string) => {
        setCommissions(deleted ? updated.filter(r => r.id !== deleted) : updated)
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
        { id: 'electricity', label: 'Electricidad', icon: <Zap size={15} />, count: electricity.length },
        { id: 'gas',         label: 'Gas',          icon: <Flame size={15} />, count: gas.length },
        { id: 'commissions', label: 'Comisiones',   icon: <BadgePercent size={15} />, count: commissions.length },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Zap size={20} fill="currentColor" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900">Gestión de Tarifas</h1>
                    <p className="text-xs text-slate-400">{isAdmin ? 'Panel administrador — edición completa' : 'Vista de lectura'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <ChevronDown size={14} className="text-slate-300" />
                    <span className="text-xs text-slate-400">{electricity.length + gas.length} tarifas · {commissions.length} reglas</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1.5 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[1.5rem] w-fit shadow-lg shadow-slate-200/50 relative">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${
                            tab === t.id
                                ? 'text-white shadow-md bg-indigo-600'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors ${tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'electricity' && (
                <ElectricityTab rows={electricity} commissions={commissions} isAdmin={isAdmin} onUpdate={handleElecUpdate} />
            )}
            {tab === 'gas' && (
                <GasTab rows={gas} commissions={commissions} isAdmin={isAdmin} onUpdate={handleGasUpdate} />
            )}
            {tab === 'commissions' && (
                <CommissionsTab rows={commissions} collaboratorPct={collaboratorPct} isAdmin={isAdmin} onUpdate={handleCommUpdate} onPctSaved={setCollaboratorPct} />
            )}
        </div>
    )
}
