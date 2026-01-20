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
      {/* LEFT SIDE: Branding & Hero Icon */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] relative flex-col justify-center items-center p-12 text-white text-center overflow-hidden">

        {/* Animated Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-500/15 rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-yellow-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Focal Point: Dynamic SVG Lightbulb */}
        <div className="relative z-10 mb-16 group">
          {/* Massive Glow Effect */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-32 h-32 bg-yellow-400/20 blur-[60px] rounded-full scale-[2.5] group-hover:bg-yellow-400/30 transition-all duration-700 animate-pulse"></div>

          <div className="relative transform transition-transform duration-700 hover:scale-105">
            <svg width="220" height="280" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_40px_rgba(251,191,36,0.5)]">
              {/* Lightbulb Glass Body - Defined Stroke for visibility */}
              <path
                d="M50 10C30 10 15 25 15 45C15 60 25 75 35 85V95H65V85C75 75 85 60 85 45C85 25 70 10 50 10Z"
                fill="url(#glassGradient)"
                stroke="rgba(251,191,36,0.3)"
                strokeWidth="1"
                className="animate-glow-strong"
              />

              {/* Filament (Glowing) - Vibrant Orange/Yellow */}
              <path d="M40 70C40 70 45 60 50 60C55 60 60 70 60 70" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" className="animate-pulse" />
              <path d="M45 65L42 45M55 65L58 45" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" className="opacity-100" />

              {/* Base - Premium Slate tones */}
              <rect x="38" y="97" width="24" height="4" rx="2" fill="#475569" />
              <rect x="40" y="103" width="20" height="4" rx="2" fill="#64748b" />
              <rect x="42" y="109" width="16" height="4" rx="2" fill="#475569" />
              <path d="M45 115C45 115 45 120 50 120C55 120 55 115 55 115" stroke="#334155" strokeWidth="5" strokeLinecap="round" />

              <defs>
                <radialGradient id="glassGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 45) rotate(90) scale(60 50)">
                  <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>

            {/* Floating Energy Particles */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full top-1/4 left-1/4 blur-[1px] animate-float-slow"></div>
              <div className="absolute w-2 h-2 bg-indigo-300 rounded-full top-3/4 right-1/4 blur-[1px] animate-float-slow" style={{ animationDelay: '1.5s' }}></div>
              <div className="absolute w-1 h-1 bg-white rounded-full top-1/2 right-[10%] blur-[0.5px] animate-float-slow" style={{ animationDelay: '3s' }}></div>
            </div>
          </div>
        </div>

        <div className="z-10 max-w-sm">
          <h1 className="text-4xl font-light tracking-tight mb-4 text-white/90">
            Gestión Energética <span className="font-semibold text-white">Inteligente.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed font-light px-8">
            Diseñando la eficiencia del futuro. <br />
            Inteligencia, control y ahorro real.
          </p>
        </div>

        <div className="absolute bottom-12 z-10 text-[10px] text-slate-500 font-mono tracking-widest uppercase opacity-40">
          Zinergia Power Operations v1.0
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white relative">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo - Prominent in the white side */}
          <div className="flex justify-center mb-10">
            <div className="transform scale-150">
              <ZinergiaLogo className="w-32 text-slate-900" />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido</h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">Introduce tus credenciales para acceder</p>
          </div>

          <form action={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Email Corporativo</label>
                <input
                  name="email"
                  type="email"
                  placeholder="usuario@zinergia.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="pt-6 text-center">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-loose">
              ¿Problemas de acceso? <br />
              <span className="text-indigo-500 cursor-pointer hover:underline">Contactar a Soporte</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
