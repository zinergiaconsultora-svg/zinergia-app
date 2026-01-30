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
    <main className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-white" role="main">
      {/* LEFT SIDE: Branding & Hero Icon */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] relative flex-col justify-center items-center p-12 text-white text-center overflow-hidden" aria-hidden="true">

        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/login-bg-bulb.png"
            alt="Realistic Lightbulb Background"
            className="w-full h-full object-cover opacity-90"
          />
          {/* Subtle gradient to ensure text legibility without hiding the bulb's detail */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 to-transparent mix-blend-overlay"></div>
        </div>

        {/* Text Container with subtle glass effect for premium feel */}
        <div className="z-10 max-w-md relative top-[15%]">
          <div className="mb-6 inline-block">
            <span className="py-1 px-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] uppercase tracking-widest font-semibold backdrop-blur-sm">
              Next Gen Energy
            </span>
          </div>
          <h1 className="text-5xl font-light tracking-tight mb-6 text-white drop-shadow-lg">
            Gestión Energética <br />
            <span className="font-semibold text-white">Inteligente.</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed font-light px-4 drop-shadow-md">
            Diseñando la eficiencia del futuro. <br />
            Inteligencia, control y ahorro real.
          </p>
        </div>

        <div className="absolute bottom-12 z-10 text-[10px] text-slate-400 font-mono tracking-widest uppercase opacity-60 mix-blend-plus-lighter">
          Zinergia Power Operations v1.0
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white relative">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo - Prominent in the white side */}
          <div className="flex justify-center mb-10">
            <div className="transform scale-150" aria-hidden="true">
              <ZinergiaLogo className="w-32 text-slate-900" />
            </div>
          </div>

          <div className="text-center">
            <h1 id="login-heading" className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido</h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Introduce tus credenciales para acceder</p>
          </div>

          <form action={handleSubmit} className="space-y-6" aria-labelledby="login-heading" noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                  Email Corporativo
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="usuario@zinergia.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
                  aria-invalid={error ? 'true' : 'false'}
                />
              </div>
            </div>

            {error && (
              <div id="login-error" className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-medium text-center" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  <span className="sr-only">Iniciando sesión...</span>
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="pt-6 text-center">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-loose">
              ¿Problemas de acceso? <br />
              <a href="mailto:soporte@zinergia.com" className="text-indigo-500 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
                Contactar a Soporte
              </a>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
