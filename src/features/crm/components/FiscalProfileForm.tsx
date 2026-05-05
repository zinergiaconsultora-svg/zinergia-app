'use client';

import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, Building2, MapPin, CreditCard, FileText } from 'lucide-react';
import { FiscalProfile } from '@/types/crm';
import { profileFiscalService } from '@/services/crm/profileFiscal';
import { updateFiscalProfileAction } from '@/app/actions/invoicing';

export const FiscalProfileForm: React.FC = () => {
    const [profile, setProfile] = useState<Partial<FiscalProfile>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        profileFiscalService.getFiscalProfile().then(data => {
            if (data) setProfile(data);
            setLoading(false);
        });
    }, []);

    const handleChange = (field: string, value: string | number) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        setMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const formData = new FormData();
        const fields = [
            'nif_cif', 'fiscal_address', 'fiscal_city', 'fiscal_province',
            'fiscal_postal_code', 'fiscal_country', 'iban', 'company_name',
            'company_type', 'retention_percent', 'invoice_prefix'
        ];
        fields.forEach(f => {
            const val = profile[f as keyof FiscalProfile];
            if (val !== undefined && val !== null) {
                formData.append(f, String(val));
            }
        });

        const result = await updateFiscalProfileAction(formData);
        setSaving(false);

        if (result.success) {
            setMessage({ type: 'success', text: 'Datos fiscales guardados. Pendientes de verificación.' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al guardar' });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
        );
    }

    const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all";
    const labelClass = "block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide";

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {profile.fiscal_verified && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200">
                    <CheckCircle className="w-4 h-4" />
                    Datos fiscales verificados el {new Date(profile.fiscal_verified_at!).toLocaleDateString('es-ES')}
                </div>
            )}

            {/* Datos Fiscales */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Datos Fiscales</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>NIF / CIF *</label>
                        <input
                            type="text"
                            value={profile.nif_cif || ''}
                            onChange={e => handleChange('nif_cif', e.target.value.toUpperCase())}
                            placeholder="12345678A / B12345678"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Tipo de Contrato</label>
                        <select
                            value={profile.company_type || ''}
                            onChange={e => handleChange('company_type', e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Particular</option>
                            <option value="autonomo">Autónomo</option>
                            <option value="sociedad_limitada">Sociedad Limitada</option>
                            <option value="sociedad_anonima">Sociedad Anónima</option>
                            <option value="cooperativa">Cooperativa</option>
                            <option value="otros">Otros</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Nombre Empresa (si aplica)</label>
                        <input
                            type="text"
                            value={profile.company_name || ''}
                            onChange={e => handleChange('company_name', e.target.value)}
                            placeholder="Tu empresa S.L."
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>

            {/* Dirección Fiscal */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Dirección Fiscal</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Dirección *</label>
                        <input
                            type="text"
                            value={profile.fiscal_address || ''}
                            onChange={e => handleChange('fiscal_address', e.target.value)}
                            placeholder="C/ Mayor 1, 3ºA"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Ciudad *</label>
                        <input
                            type="text"
                            value={profile.fiscal_city || ''}
                            onChange={e => handleChange('fiscal_city', e.target.value)}
                            placeholder="Madrid"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Provincia *</label>
                        <input
                            type="text"
                            value={profile.fiscal_province || ''}
                            onChange={e => handleChange('fiscal_province', e.target.value)}
                            placeholder="Madrid"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Código Postal *</label>
                        <input
                            type="text"
                            value={profile.fiscal_postal_code || ''}
                            onChange={e => handleChange('fiscal_postal_code', e.target.value)}
                            placeholder="28001"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>País</label>
                        <input
                            type="text"
                            value={profile.fiscal_country || 'España'}
                            onChange={e => handleChange('fiscal_country', e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>

            {/* Datos Bancarios */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Datos Bancarios</h3>
                </div>
                <div>
                    <label className={labelClass}>IBAN *</label>
                    <input
                        type="text"
                        value={profile.iban || ''}
                        onChange={e => handleChange('iban', e.target.value.toUpperCase())}
                        placeholder="ES00 0000 0000 0000 0000 0000"
                        className={inputClass}
                        maxLength={27}
                        required
                    />
                    <p className="text-xs text-slate-400 mt-1">Cuenta bancaria para recibir los pagos de comisiones</p>
                </div>
            </div>

            {/* Configuración Facturación */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Configuración Facturación</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Prefijo Factura</label>
                        <input
                            type="text"
                            value={profile.invoice_prefix || 'FAC'}
                            onChange={e => handleChange('invoice_prefix', e.target.value.toUpperCase())}
                            placeholder="FAC"
                            className={inputClass}
                            maxLength={6}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Retención IRPF (%)</label>
                        <input
                            type="number"
                            value={profile.retention_percent || 0}
                            onChange={e => handleChange('retention_percent', parseFloat(e.target.value) || 0)}
                            min="0"
                            max="100"
                            step="0.01"
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-400 mt-1">15% para autónomos, 0% para SL/SA</p>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar Datos Fiscales'}
                </button>
            </div>
        </form>
    );
};