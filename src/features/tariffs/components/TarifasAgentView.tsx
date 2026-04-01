'use client'

import { useState, useMemo } from 'react'
import { Zap, Flame, Euro, Info, Search, Building2, Users, TrendingUp, Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import type { TarifaRow, TariffCommissionRow } from '@/app/actions/tariffs'

interface Props {
    electricity: TarifaRow[]
    gas: TarifaRow[]
    commissions: TariffCommissionRow[]
    collaboratorPct: number
}

type Tab = 'electricity' | 'gas'

const MODELO_COLORS: Record<string, string> = {
    BASE:  'bg-slate-100 text-slate-600',
    ONE:   'bg-blue-50 text-blue-600',
    SUPRA: 'bg-indigo-50 text-indigo-700',
}

// ─── Commission resolver ──────────────────────────────────────────────────────
// Returns the best-matching commissions for a given tariff row.
// A tariff can have up to 2 tiers: fixed (small consumption) + variable (large).

interface CommissionInfo {
    fixed: number | null    // € per contract (small consumption)
    variable: number | null // € per MWh (large consumption)
    threshold: number | null
}

function resolveCommission(
    tarifa: TarifaRow,
    commissions: TariffCommissionRow[],
    collaboratorPct: number,
): CommissionInfo {
    // Match by company + modelo (NULL modelo = applies to all modelos)
    const candidates = commissions.filter(c =>
        c.company === tarifa.company &&
        c.supply_type === tarifa.supply_type &&
        (c.modelo === null || c.modelo === tarifa.modelo) &&
        c.is_active,
    )

    if (candidates.length === 0) return { fixed: null, variable: null, threshold: null }

    // Prefer modelo-specific over NULL-modelo
    const specific = candidates.filter(c => c.modelo === tarifa.modelo)
    const pool = specific.length > 0 ? specific : candidates

    // Tier with min=0 → fixed commission
    const fixedTier = pool.find(c => c.consumption_min_mwh === 0 && c.commission_fixed_eur > 0)
    // Tier with min>0 → variable commission
    const varTier = pool.find(c => c.consumption_min_mwh > 0 && c.commission_variable_mwh > 0)

    return {
        fixed:     fixedTier ? fixedTier.commission_fixed_eur * collaboratorPct : null,
        variable:  varTier   ? varTier.commission_variable_mwh * collaboratorPct : null,
        threshold: varTier?.consumption_min_mwh ?? null,
    }
}

// ─── Commission badge ─────────────────────────────────────────────────────────

function CommBadge({ info }: { info: CommissionInfo }) {
    if (info.fixed === null && info.variable === null) {
        return <span className="text-slate-300 text-xs">—</span>
    }
    return (
        <div className="flex flex-col items-end gap-0.5">
            {info.fixed !== null && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <Euro size={10} />
                    {info.fixed.toFixed(2)} <span className="font-normal text-slate-400">/contrato</span>
                </span>
            )}
            {info.variable !== null && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600">
                    <TrendingUp size={9} />
                    {info.variable.toFixed(2)} <span className="font-normal text-slate-400">/MWh {info.threshold ? `(+${info.threshold} MWh)` : ''}</span>
                </span>
            )}
        </div>
    )
}

// ─── Electricity table ────────────────────────────────────────────────────────

function ElecTable({ rows, commissions, collaboratorPct }: { rows: TarifaRow[]; commissions: TariffCommissionRow[]; collaboratorPct: number }) {
    const [search, setSearch] = useState('')
    const [companyFilter, setCompanyFilter] = useState('ALL')

    const companies = useMemo(() => [...new Set(rows.map(r => r.company))].sort(), [rows])
    const filtered = useMemo(() => rows.filter(r =>
        r.is_active &&
        (companyFilter === 'ALL' || r.company === companyFilter) &&
        (r.tariff_name.toLowerCase().includes(search.toLowerCase()) ||
            r.company.toLowerCase().includes(search.toLowerCase()))
    ), [rows, companyFilter, search])

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="Buscar..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-1 flex-wrap">
                    {['ALL', ...companies].map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCompanyFilter(c)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${companyFilter === c
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
                        >
                            {c === 'ALL' ? 'Todas' : c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Compañía</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-500">Producto</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Modelo</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">ATR</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500">Cliente</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Energía P1</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Energía P2</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Energía P3</th>
                            <th className="text-right px-3 py-3 font-semibold text-slate-500">Pot. P1</th>
                            <th className="text-right px-3 py-3 font-semibold text-emerald-600">Tu comisión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filtered.map(row => {
                            const comm = resolveCommission(row, commissions, collaboratorPct)
                            const hasComm = comm.fixed !== null || comm.variable !== null
                            return (
                                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${row.logo_color || 'bg-slate-600'}`}>
                                                {row.company.slice(0, 2)}
                                            </div>
                                            <span className="font-semibold text-slate-800">{row.company}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 max-w-[180px]">
                                        <p className="truncate font-medium">{row.tariff_name}</p>
                                        {row.notes && <p className="text-[10px] text-slate-400 truncate">{row.notes}</p>}
                                    </td>
                                    <td className="px-3 py-3">
                                        {row.modelo ? (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${MODELO_COLORS[row.modelo] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {row.modelo}
                                            </span>
                                        ) : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-slate-600 text-[11px]">{row.tariff_type ?? '—'}</td>
                                    <td className="px-3 py-3">
                                        <span className="flex items-center gap-1 text-slate-500">
                                            {row.tipo_cliente === 'PYME' ? <Building2 size={10} /> : <Users size={10} />}
                                            {row.tipo_cliente}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-700">
                                        {row.energy_price_p1 === 0 ? '—' : row.energy_price_p1.toFixed(5)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-500">
                                        {row.energy_price_p2 === 0 ? '—' : row.energy_price_p2.toFixed(5)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-500">
                                        {row.energy_price_p3 === 0 ? '—' : row.energy_price_p3.toFixed(5)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-500">
                                        {row.power_price_p1 === 0 ? '—' : row.power_price_p1.toFixed(5)}
                                    </td>
                                    <td className={`px-3 py-3 text-right ${hasComm ? 'bg-emerald-50/60' : ''}`}>
                                        <CommBadge info={comm} />
                                    </td>
                                </tr>
                            )
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={10} className="text-center py-10 text-slate-400">Sin resultados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Gas table ────────────────────────────────────────────────────────────────

function GasTable({ rows, commissions, collaboratorPct }: { rows: TarifaRow[]; commissions: TariffCommissionRow[]; collaboratorPct: number }) {
    const active = rows.filter(r => r.is_active)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Compañía</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Producto</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-500">Tramo ATR</th>
                        <th className="text-right px-3 py-3 font-semibold text-slate-500">Consumo (kWh/año)</th>
                        <th className="text-right px-3 py-3 font-semibold text-slate-500">Fijo €/año</th>
                        <th className="text-right px-3 py-3 font-semibold text-slate-500">Variable €/kWh</th>
                        <th className="text-right px-3 py-3 font-semibold text-emerald-600">Tu comisión</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {active.map(row => {
                        const comm = resolveCommission(row, commissions, collaboratorPct)
                        const hasComm = comm.fixed !== null || comm.variable !== null
                        return (
                            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${row.logo_color || 'bg-orange-500'}`}>
                                            {row.company.slice(0, 2)}
                                        </div>
                                        <span className="font-semibold text-slate-800">{row.company}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-700 font-medium">{row.tariff_name}</td>
                                <td className="px-3 py-3 font-mono text-slate-600">{row.tariff_type ?? '—'}</td>
                                <td className="px-3 py-3 text-right text-slate-600">
                                    {row.consumption_min_kwh.toLocaleString()} – {row.consumption_max_kwh >= 9999999999 ? '∞' : row.consumption_max_kwh.toLocaleString()}
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-slate-700">
                                    {row.fixed_annual_fee_gas === 0 ? '—' : `${row.fixed_annual_fee_gas.toFixed(6)} €`}
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-slate-700">
                                    {row.variable_price_kwh_gas === 0 ? '—' : `${row.variable_price_kwh_gas.toFixed(6)} €`}
                                </td>
                                <td className={`px-3 py-3 text-right ${hasComm ? 'bg-emerald-50/60' : ''}`}>
                                    <CommBadge info={comm} />
                                </td>
                            </tr>
                        )
                    })}
                    {active.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-slate-400">Sin tarifas de gas activas</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ─── Commission Simulator ─────────────────────────────────────────────────────

function CommissionSimulator({ electricity, gas, commissions, collaboratorPct }: Props) {
    const [open, setOpen] = useState(false)
    const [mwh, setMwh] = useState('')
    const [supply, setSupply] = useState<'electricity' | 'gas'>('electricity')

    const mwhNum = parseFloat(mwh) || 0

    const results = useMemo(() => {
        if (mwhNum <= 0) return []
        const rows = supply === 'electricity' ? electricity : gas
        return rows
            .filter(r => r.is_active)
            .map(row => {
                const candidates = commissions.filter(c =>
                    c.company === row.company &&
                    c.supply_type === row.supply_type &&
                    (c.modelo === null || c.modelo === row.modelo) &&
                    c.is_active,
                )
                const specific = candidates.filter(c => c.modelo === row.modelo)
                const pool = specific.length > 0 ? specific : candidates

                // Find the applicable tier for this consumption level
                const tier = pool.find(c =>
                    mwhNum >= c.consumption_min_mwh && mwhNum < c.consumption_max_mwh
                )
                if (!tier) return null

                const earned = tier.commission_fixed_eur > 0
                    ? tier.commission_fixed_eur * collaboratorPct
                    : tier.commission_variable_mwh * collaboratorPct * mwhNum

                return { row, tier, earned }
            })
            .filter(Boolean)
            .sort((a, b) => b!.earned - a!.earned) as { row: TarifaRow; tier: TariffCommissionRow; earned: number }[]
    }, [mwhNum, supply, electricity, gas, commissions, collaboratorPct])

    return (
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 p-4 hover:bg-teal-100/40 transition-colors"
            >
                <div className="w-8 h-8 bg-teal-500 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Calculator size={15} />
                </div>
                <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-teal-900">Simulador de comisión</p>
                    <p className="text-[11px] text-teal-600">Introduce el consumo del cliente y calcula cuánto ganarás</p>
                </div>
                {open ? <ChevronUp size={16} className="text-teal-500" /> : <ChevronDown size={16} className="text-teal-500" />}
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-4">
                    <div className="flex items-end gap-3 flex-wrap">
                        <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Suministro</label>
                            <div className="flex gap-1">
                                {(['electricity', 'gas'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setSupply(s)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                            supply === s
                                                ? s === 'electricity' ? 'bg-indigo-600 text-white' : 'bg-orange-500 text-white'
                                                : 'bg-white border border-slate-200 text-slate-500'
                                        }`}
                                    >
                                        {s === 'electricity' ? <Zap size={11} /> : <Flame size={11} />}
                                        {s === 'electricity' ? 'Luz' : 'Gas'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[140px]">
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Consumo anual (MWh)</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="Ej: 25"
                                value={mwh}
                                onChange={e => setMwh(e.target.value)}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none"
                            />
                        </div>
                    </div>

                    {mwhNum > 0 && results.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-3">Sin comisiones configuradas para este consumo</p>
                    )}

                    {results.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Producto</th>
                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Modelo</th>
                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">Tipo comisión</th>
                                        <th className="text-right px-3 py-2 font-semibold text-emerald-600">Tu comisión</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {results.map(({ row, tier, earned }, i) => (
                                        <tr key={row.id} className={i === 0 ? 'bg-emerald-50/50' : ''}>
                                            <td className="px-3 py-2 font-medium text-slate-800">
                                                {row.company} · {row.tariff_name}
                                            </td>
                                            <td className="px-3 py-2">
                                                {row.modelo
                                                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">{row.modelo}</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-500">
                                                {tier.commission_fixed_eur > 0 ? 'Fija' : `${tier.commission_variable_mwh.toFixed(2)} €/MWh × ${mwhNum} MWh`}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-emerald-600">
                                                {earned.toFixed(2)} €
                                                {i === 0 && <span className="ml-1 text-[9px] bg-emerald-500 text-white px-1 rounded">mejor</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TarifasAgentView({ electricity, gas, commissions, collaboratorPct }: Props) {
    const [tab, setTab] = useState<Tab>('electricity')

    // Stats for the agent
    const elecWithComm = useMemo(() =>
        electricity.filter(r => r.is_active && resolveCommission(r, commissions, collaboratorPct).fixed !== null).length,
        [electricity, commissions, collaboratorPct]
    )

    const tabs = [
        { id: 'electricity' as Tab, label: 'Electricidad', icon: <Zap size={14} />, count: electricity.filter(r => r.is_active).length },
        { id: 'gas'         as Tab, label: 'Gas',          icon: <Flame size={14} />, count: gas.filter(r => r.is_active).length },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0">
                    <Euro size={20} />
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-black text-slate-900">Tarifas disponibles</h1>
                    <p className="text-xs text-slate-400 mt-0.5">Precios de mercado y tu comisión por cada producto que comercialices</p>
                </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <Info size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                    <p className="text-xs font-semibold text-emerald-800">
                        Tu comisión es el {Math.round(collaboratorPct * 100)}% de la comisión bruta de cada producto.
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                        La columna <span className="font-bold">Tu comisión</span> muestra lo que recibirás si el cliente firma ese producto.
                        Para consumos pequeños es una cantidad fija por contrato; para consumos grandes, una comisión variable por MWh contratado.
                    </p>
                </div>
            </div>

            {/* Simulador de comisión */}
            <CommissionSimulator electricity={electricity} gas={gas} commissions={commissions} collaboratorPct={collaboratorPct} />

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tarifas luz', value: electricity.filter(r => r.is_active).length, sub: 'disponibles', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Tarifas gas', value: gas.filter(r => r.is_active).length, sub: 'disponibles', color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Con comisión', value: elecWithComm, sub: 'productos luz', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Tu %', value: `${Math.round(collaboratorPct * 100)}%`, sub: 'de la comisión', color: 'text-teal-600', bg: 'bg-teal-50' },
                ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                        <p className={`text-2xl font-black ${c.color} mt-1`}>{c.value}</p>
                        <p className="text-[10px] text-slate-400">{c.sub}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-2xl w-fit">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            tab === t.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Content */}
            {tab === 'electricity' && (
                <ElecTable rows={electricity} commissions={commissions} collaboratorPct={collaboratorPct} />
            )}
            {tab === 'gas' && (
                <GasTable rows={gas} commissions={commissions} collaboratorPct={collaboratorPct} />
            )}
        </div>
    )
}
