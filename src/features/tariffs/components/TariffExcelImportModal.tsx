'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { TarifaRow } from '@/app/actions/tariffs'
import { bulkUpsertTarifasAction } from '@/app/actions/tariffs'

interface Props {
    supplyType: 'electricity' | 'gas'
    onClose: () => void
    onSuccess: (newRows: TarifaRow[]) => void
}

// Column name aliases → TarifaRow field
const ALIASES: Record<string, keyof TarifaRow> = {
    company: 'company', compañia: 'company', comercializadora: 'company',
    tariff_name: 'tariff_name', nombre_tarifa: 'tariff_name', tarifa: 'tariff_name', producto: 'tariff_name',
    tariff_type: 'tariff_type', tipo_tarifa: 'tariff_type',
    modelo: 'modelo',
    tipo_cliente: 'tipo_cliente', cliente: 'tipo_cliente',
    offer_type: 'offer_type', tipo_oferta: 'offer_type',
    contract_duration: 'contract_duration', duracion: 'contract_duration',
    energy_price_p1: 'energy_price_p1', ep1: 'energy_price_p1', e_p1: 'energy_price_p1',
    energy_price_p2: 'energy_price_p2', ep2: 'energy_price_p2', e_p2: 'energy_price_p2',
    energy_price_p3: 'energy_price_p3', ep3: 'energy_price_p3', e_p3: 'energy_price_p3',
    energy_price_p4: 'energy_price_p4', ep4: 'energy_price_p4', e_p4: 'energy_price_p4',
    energy_price_p5: 'energy_price_p5', ep5: 'energy_price_p5', e_p5: 'energy_price_p5',
    energy_price_p6: 'energy_price_p6', ep6: 'energy_price_p6', e_p6: 'energy_price_p6',
    power_price_p1: 'power_price_p1', pp1: 'power_price_p1', p_p1: 'power_price_p1',
    power_price_p2: 'power_price_p2', pp2: 'power_price_p2', p_p2: 'power_price_p2',
    power_price_p3: 'power_price_p3', pp3: 'power_price_p3', p_p3: 'power_price_p3',
    power_price_p4: 'power_price_p4', pp4: 'power_price_p4', p_p4: 'power_price_p4',
    power_price_p5: 'power_price_p5', pp5: 'power_price_p5', p_p5: 'power_price_p5',
    power_price_p6: 'power_price_p6', pp6: 'power_price_p6', p_p6: 'power_price_p6',
    connection_fee: 'connection_fee', alquiler: 'connection_fee',
    fixed_fee: 'fixed_fee', cuota_fija: 'fixed_fee',
    consumption_min_kwh: 'consumption_min_kwh', consumo_min: 'consumption_min_kwh',
    consumption_max_kwh: 'consumption_max_kwh', consumo_max: 'consumption_max_kwh',
    fixed_annual_fee_gas: 'fixed_annual_fee_gas', cuota_anual_gas: 'fixed_annual_fee_gas',
    variable_price_kwh_gas: 'variable_price_kwh_gas', precio_kwh_gas: 'variable_price_kwh_gas',
    notes: 'notes', notas: 'notes',
}

function normalizeHeader(h: string): string {
    return h.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
        .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
        .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
}

function downloadTemplate(supplyType: 'electricity' | 'gas') {
    const cols = supplyType === 'electricity'
        ? ['company', 'tariff_name', 'tariff_type', 'modelo', 'tipo_cliente', 'offer_type',
            'energy_price_p1', 'energy_price_p2', 'energy_price_p3', 'power_price_p1', 'power_price_p2', 'power_price_p3',
            'connection_fee', 'fixed_fee', 'notes']
        : ['company', 'tariff_name', 'tipo_cliente', 'fixed_annual_fee_gas', 'variable_price_kwh_gas', 'notes']
    const example = supplyType === 'electricity'
        ? ['Endesa', 'One Luz Fija', '3.0TD', 'Mercado', 'PYME', 'fixed', '0.12', '0.10', '0.08', '38.0', '38.0', '0', '0', '0', '']
        : ['Naturgy', 'Tarifa Gas Básica', 'PYME', '18', '0.055', '']
    const bom = '\uFEFF'
    const blob = new Blob([bom + cols.join(',') + '\r\n' + example.join(',') + '\r\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantilla-tarifas-${supplyType}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

type Step = 'upload' | 'preview' | 'done'

export function TariffExcelImportModal({ supplyType, onClose, onSuccess }: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [step, setStep] = useState<Step>('upload')
    const [isDragging, setIsDragging] = useState(false)
    const [parsed, setParsed] = useState<Array<Partial<TarifaRow>>>([])
    const [parseError, setParseError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ upserted: number; errors: string[] } | null>(null)

    const processFile = useCallback(async (file: File) => {
        setParseError(null)
        try {
            const { read, utils } = await import('xlsx')
            const buffer = await file.arrayBuffer()
            const wb = read(buffer)
            const ws = wb.Sheets[wb.SheetNames[0]]
            const raw: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: '' })

            if (raw.length === 0) { setParseError('El archivo no contiene filas de datos.'); return }
            if (raw.length > 300) { setParseError('El archivo supera el límite de 300 filas.'); return }

            // Map each row
            const rows: Array<Partial<TarifaRow>> = raw.map(rawRow => {
                const mapped: Partial<TarifaRow> = {}
                Object.entries(rawRow).forEach(([col, val]) => {
                    const norm = normalizeHeader(col)
                    const field = ALIASES[norm]
                    if (field) (mapped as Record<string, unknown>)[field] = val
                })
                return mapped
            }).filter(r => r.company || r.tariff_name)

            if (rows.length === 0) { setParseError('No se pudieron mapear columnas. Descarga la plantilla para ver el formato.'); return }

            setParsed(rows)
            setStep('preview')
        } catch {
            setParseError('Error leyendo el archivo. Asegúrate de que es un Excel (.xlsx) o CSV válido.')
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleImport = async () => {
        setLoading(true)
        try {
            const res = await bulkUpsertTarifasAction(parsed, supplyType)
            setResult(res)
            setStep('done')
            if (res.upserted > 0) {
                toast.success(`${res.upserted} tarifas importadas correctamente`)
                // Reload won't return new rows directly, parent will re-fetch via onSuccess
                onSuccess([])
            }
        } catch (err) {
            setParseError(err instanceof Error ? err.message : 'Error al importar')
        } finally {
            setLoading(false)
        }
    }

    const supplyLabel = supplyType === 'electricity' ? 'Electricidad' : 'Gas'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Importar tarifas · {supplyLabel}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Excel (.xlsx) o CSV con columnas estándar</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => inputRef.current?.click()}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                    <FileSpreadsheet size={26} className="text-emerald-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-slate-800">Arrastra tu Excel o CSV aquí</p>
                                    <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
                                </div>
                                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]) }} />
                            </div>

                            {parseError && (
                                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{parseError}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Upload size={15} className="text-slate-400" />
                                    <span className="text-sm">Descarga la plantilla con el formato correcto</span>
                                </div>
                                <button type="button" onClick={e => { e.stopPropagation(); downloadTemplate(supplyType) }} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                                    <Download size={13} /> Plantilla
                                </button>
                            </div>

                            <p className="text-xs text-slate-400">
                                Las tarifas se actualizarán si ya existe una con la misma compañía + nombre + tipo de suministro. Las nuevas se crearán.
                            </p>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                {parsed.length} tarifas listas para importar
                            </div>
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto max-h-64">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr>
                                                {['Compañía', 'Tarifa', 'Tipo', 'E.P1', 'E.P2', 'E.P3', 'Pot.P1'].map(h => (
                                                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {parsed.slice(0, 20).map((r, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[120px] truncate">{String(r.company ?? '—')}</td>
                                                    <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{String(r.tariff_name ?? '—')}</td>
                                                    <td className="px-3 py-2 text-slate-500">{String(r.tariff_type ?? r.offer_type ?? '—')}</td>
                                                    <td className="px-3 py-2 text-slate-500 font-mono">{r.energy_price_p1 ? Number(r.energy_price_p1).toFixed(4) : '—'}</td>
                                                    <td className="px-3 py-2 text-slate-500 font-mono">{r.energy_price_p2 ? Number(r.energy_price_p2).toFixed(4) : '—'}</td>
                                                    <td className="px-3 py-2 text-slate-500 font-mono">{r.energy_price_p3 ? Number(r.energy_price_p3).toFixed(4) : '—'}</td>
                                                    <td className="px-3 py-2 text-slate-500 font-mono">{r.power_price_p1 ? Number(r.power_price_p1).toFixed(4) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {parsed.length > 20 && (
                                    <div className="px-3 py-2 text-[11px] text-slate-400 bg-slate-50 border-t border-slate-100">
                                        Mostrando 20 de {parsed.length} filas
                                    </div>
                                )}
                            </div>
                            {parseError && (
                                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{parseError}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="space-y-4 py-4">
                            <div className="flex flex-col items-center gap-3 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                </div>
                                <p className="text-lg font-semibold text-slate-900">{result.upserted} tarifas importadas</p>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                                    <p className="text-xs font-semibold text-red-600 mb-2">Filas con errores:</p>
                                    <ul className="space-y-1">
                                        {result.errors.map((e, i) => <li key={i} className="text-xs text-red-600">{e}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3">
                    {step === 'preview' && (
                        <button type="button" onClick={() => { setStep('upload'); setParsed([]); setParseError(null) }} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
                            ← Cambiar archivo
                        </button>
                    )}
                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                            {step === 'done' ? 'Cerrar' : 'Cancelar'}
                        </button>
                        {step === 'preview' && (
                            <button type="button" onClick={handleImport} disabled={loading} className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                {loading ? 'Importando…' : `Importar ${parsed.length} tarifas`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
