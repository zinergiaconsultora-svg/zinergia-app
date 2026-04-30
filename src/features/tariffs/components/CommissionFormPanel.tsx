'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Save } from 'lucide-react'
import { TariffCommissionRow, upsertTariffCommission } from '@/app/actions/tariffs'
import { Field } from './Field'
import { inputCls, selectCls } from './tariff-form-utils'

interface Props {
    data: Partial<TariffCommissionRow>
    onClose: () => void
    onSaved: (row: TariffCommissionRow) => void
}

export function CommissionFormPanel({ data, onClose, onSaved }: Props) {
    const [form, setForm] = useState<Partial<TariffCommissionRow>>(data)
    const [pending, start] = useTransition()

    const set = (k: keyof TariffCommissionRow, v: unknown) => setForm(f => ({ ...f, [k]: v }))
    const setN = (k: keyof TariffCommissionRow) => (e: React.ChangeEvent<HTMLInputElement>) =>
        set(k, parseFloat(e.target.value) || 0)

    const handleSave = () => {
        if (!form.company?.trim()) { toast.error('La compañía es obligatoria'); return }
        if (!form.producto_tipo?.trim()) { toast.error('El tipo de producto es obligatorio'); return }
        if ((form.commission_fixed_eur ?? 0) === 0 && (form.commission_variable_mwh ?? 0) === 0) {
            toast.error('Introduce al menos una comisión (fija o variable)'); return
        }

        start(async () => {
            try {
                const row = await upsertTariffCommission(form)
                onSaved(row)
                toast.success(form.id ? 'Comisión actualizada' : 'Comisión creada')
                onClose()
            } catch (e) {
                toast.error((e as Error).message)
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/50">
                    <h2 className="font-black text-slate-900 text-lg">{form.id ? 'Editar Regla de Comisión' : 'Nueva Regla'}</h2>
                    <button type="button" onClick={onClose} aria-label="Cerrar panel" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-5">
                    <Field label="Compañía">
                        <input className={inputCls} value={form.company ?? ''} onChange={e => set('company', e.target.value)} />
                    </Field>
                    <Field label="Modelo">
                        <select className={selectCls} value={form.modelo ?? ''} onChange={e => set('modelo', e.target.value || null)}>
                            <option value="">Todos</option>
                            <option value="BASE">BASE</option>
                            <option value="ONE">ONE</option>
                            <option value="SUPRA">SUPRA</option>
                        </select>
                    </Field>
                    <Field label="Suministro">
                        <select className={selectCls} value={form.supply_type ?? 'electricity'} onChange={e => set('supply_type', e.target.value)}>
                            <option value="electricity">Electricidad</option>
                            <option value="gas">Gas</option>
                        </select>
                    </Field>
                    <Field label="Tipo cliente">
                        <select className={selectCls} value={form.tipo_cliente ?? 'PYME'} onChange={e => set('tipo_cliente', e.target.value)}>
                            <option value="PYME">PYME</option>
                            <option value="RESIDENCIAL">Residencial</option>
                            <option value="GRAN_CUENTA">Gran Cuenta</option>
                        </select>
                    </Field>
                    <Field label="Tipo producto">
                        <input className={inputCls} value={form.producto_tipo ?? ''} onChange={e => set('producto_tipo', e.target.value)} placeholder="ELECTRICIDAD_FIJO, GAS..." />
                    </Field>
                    <Field label="Servicio">
                        <select className={selectCls} value={form.servicio ?? 'LUZ'} onChange={e => set('servicio', e.target.value)}>
                            <option value="LUZ">LUZ</option>
                            <option value="GAS">GAS</option>
                        </select>
                    </Field>
                    <Field label="Consumo mín (MWh/año)">
                        <input type="number" className={inputCls} value={form.consumption_min_mwh ?? 0} onChange={setN('consumption_min_mwh')} />
                    </Field>
                    <Field label="Consumo máx (MWh/año)">
                        <input type="number" className={inputCls} value={form.consumption_max_mwh ?? 0} onChange={setN('consumption_max_mwh')} />
                    </Field>
                    <Field label="Comisión fija (€/contrato)">
                        <input type="number" step="0.01" className={inputCls} value={form.commission_fixed_eur ?? 0} onChange={setN('commission_fixed_eur')} />
                    </Field>
                    <Field label="Comisión variable (€/MWh)">
                        <input type="number" step="0.01" className={inputCls} value={form.commission_variable_mwh ?? 0} onChange={setN('commission_variable_mwh')} />
                    </Field>
                    <div className="col-span-2">
                        <Field label="Notas">
                            <input className={inputCls} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
                        </Field>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-5 bg-slate-50/50 border-t border-slate-100/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-200/50">Cancelar</button>
                    <button type="button" onClick={handleSave} disabled={pending} className="px-5 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50">
                        <Save size={14} />{pending ? 'Guardando…' : 'Guardar regla'}
                    </button>
                </div>
            </div>
        </div>
    )
}
