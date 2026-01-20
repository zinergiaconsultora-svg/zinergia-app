'use client';

import React, { useState } from 'react';
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
import { Card } from '@/components/ui/primitives/Card';
import { PageTitle, BodyText } from '@/components/ui/primitives/Typography';
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
    <main className="min-h-screen bg-slate-50 dark:bg-black p-4 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background blobs for "Organic Flow" */}
      <div className="absolute top-0 -left-20 w-80 h-80 bg-energy-400/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-blue-400/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <ZinergiaLogo className="w-48 mb-4 animate-slide-up" />
          <PageTitle className="animate-slide-up [animation-delay:100ms]">
            Consultoría Energética <br /> Escalable
          </PageTitle>
          <BodyText className="animate-slide-up [animation-delay:200ms]">
            Analiza facturas, optimiza tarifas y gestiona tu red de colaboradores desde un solo lugar.
          </BodyText>
        </div>

        <Card className="p-8 space-y-6 animate-slide-up [animation-delay:300ms]">
          <form action={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-energy-500 outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-energy-500 outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-energy-600 hover:bg-energy-700 text-white font-bold rounded-2xl shadow-lg shadow-energy-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Entrar a la Plataforma'
              )}
            </button>
          </form>

          <div className="text-center">
            <button className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-energy-500 transition-colors">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </Card>

        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Zinergia Power Operations v1.0
        </p>
      </div>
    </main>
  );
}
