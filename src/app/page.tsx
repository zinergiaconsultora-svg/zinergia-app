'use client';

import React, { useState } from 'react';
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
import { login } from '@/app/auth/actions';

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await login(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <main className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-white">
      {/* LEFT SIDE: Branding (Desktop Only) - Solid/Professional */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative flex-col justify-between p-12 text-white">
        <div className="z-10">
          <ZinergiaLogo className="w-24 opacity-80" />
        </div>

        <div className="z-10 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Gestión Energética Inteligente.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Plataforma centralizada para consultores. Optimiza tarifas, gestiona clientes y analiza datos en tiempo real.
          </p>
        </div>

        <div className="z-10 text-xs text-slate-500 font-mono">
          Zinergia Power Operations v1.0
        </div>

        {/* Subtle decorative gradient overlay, extremely minimal */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/50 to-slate-900/0 pointer-events-none"></div>
      </div>

      {/* RIGHT SIDE: Functional Login (Mobile: Full Screen) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gray-50/50">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile Logo (Visible only on mobile) */}
          <div className="lg:hidden flex justify-center mb-8">
            <ZinergiaLogo className="w-32 text-slate-900" />
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido</h2>
            <p className="text-sm text-slate-500 mt-2">Introduce tus credenciales para acceder al sistema.</p>
          </div>

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">Email Corporativo</label>
                <input
                  name="email"
                  type="email"
                  placeholder="usuario@zinergia.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="pt-4 text-center">
            <span className="text-xs text-slate-400">¿Problemas de acceso? Contacta a Soporte.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
