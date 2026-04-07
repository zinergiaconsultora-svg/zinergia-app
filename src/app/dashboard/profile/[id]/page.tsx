import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Shield, User, Building2, Calendar, Users } from 'lucide-react';
import Link from 'next/link';

const ROLE_LABEL: Record<string, string> = {
    admin: 'Administrador',
    franchise: 'Franquicia',
    agent: 'Colaborador',
};

const ROLE_COLOR: Record<string, string> = {
    admin: 'bg-rose-50 text-rose-600 border-rose-100',
    franchise: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    agent: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, bio, created_at, franchise_id, parent_id')
        .eq('id', id)
        .single();

    if (!profile) notFound();

    // Get parent info
    const { data: parent } = profile.parent_id
        ? await supabase.from('profiles').select('full_name, role').eq('id', profile.parent_id).single()
        : { data: null };

    // Get franchise info
    const { data: franchiseConfig } = profile.franchise_id
        ? await supabase.from('franchise_config').select('company_name').eq('franchise_id', profile.franchise_id).single()
        : { data: null };

    // Get direct reports count
    const { count: teamCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', id);

    // Get client count
    const { count: clientCount } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', id);

    const roleColor = ROLE_COLOR[profile.role ?? ''] ?? 'bg-slate-50 text-slate-600 border-slate-100';
    const roleLabel = ROLE_LABEL[profile.role ?? ''] ?? profile.role ?? 'Usuario';
    const joinedDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Back */}
            <Link
                href="/dashboard/network"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-8 group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Volver a Mi Red
            </Link>

            {/* Header card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold ${profile.role === 'franchise' ? 'bg-indigo-600 text-white' : profile.role === 'admin' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-slate-900">{profile.full_name ?? 'Sin nombre'}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${roleColor}`}>
                                {roleLabel}
                            </span>
                        </div>
                        {franchiseConfig?.company_name && (
                            <p className="text-sm text-slate-500 flex items-center gap-1.5">
                                <Building2 size={14} />
                                {franchiseConfig.company_name}
                            </p>
                        )}
                        {joinedDate && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                                <Calendar size={12} />
                                Miembro desde {joinedDate}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Stats */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Actividad</p>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500 flex items-center gap-2"><Users size={16} className="text-indigo-400" /> Equipo directo</span>
                            <span className="font-bold text-slate-900">{teamCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500 flex items-center gap-2"><User size={16} className="text-emerald-400" /> Clientes en cartera</span>
                            <span className="font-bold text-slate-900">{clientCount ?? 0}</span>
                        </div>
                    </div>
                </div>

                {/* Hierarchy */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Jerarquía</p>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-400 mb-1">Rol</p>
                            <p className="font-semibold text-slate-800 flex items-center gap-2">
                                <Shield size={14} className="text-slate-400" />
                                {roleLabel}
                            </p>
                        </div>
                        {parent && (
                            <div>
                                <p className="text-xs text-slate-400 mb-1">Reporta a</p>
                                <p className="font-semibold text-slate-800 text-sm">{parent.full_name}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-6">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Contacto</p>
                <div className="space-y-3">
                    {profile.email ? (
                        <a href={`mailto:${profile.email}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-indigo-600 transition-colors group">
                            <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                <Mail size={16} className="text-slate-400 group-hover:text-indigo-500" />
                            </div>
                            {profile.email}
                        </a>
                    ) : (
                        <p className="text-sm text-slate-400 italic flex items-center gap-3"><Mail size={16} /> Sin email registrado</p>
                    )}
                    {profile.phone ? (
                        <a href={`tel:${profile.phone}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-indigo-600 transition-colors group">
                            <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                <Phone size={16} className="text-slate-400 group-hover:text-indigo-500" />
                            </div>
                            {profile.phone}
                        </a>
                    ) : (
                        <p className="text-sm text-slate-400 italic flex items-center gap-3"><Phone size={16} /> Sin teléfono registrado</p>
                    )}
                </div>
            </div>

            {/* Bio */}
            {profile.bio && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Sobre este colaborador</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{profile.bio}</p>
                </div>
            )}
        </div>
    );
}
