'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
import { login } from '@/app/auth/actions';
import { Button } from '@/components/ui/primitives/Button';
import { Input } from '@/components/ui/primitives/Input';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

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
          <Image
            src="/images/login-bg-bulb.png"
            alt="Realistic Lightbulb Background"
            fill
            className="object-cover opacity-90"
            priority
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
            <div className="space-y-5">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="usuario@zinergia.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                label="Email Corporativo"
                icon={<Mail size={18} />}
                className="py-6"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'login-error' : undefined}
              />

              <div className="space-y-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  label="Contraseña"
                  icon={<Lock size={18} />}
                  className="py-6"
                  aria-invalid={error ? 'true' : 'false'}
                />
                <div className="flex justify-end">
                  <a href="#" className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>
            </div>

            {error && (
              <div id="login-error" className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2" role="alert">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              className="w-full py-6 text-base rounded-2xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
              rightIcon={<ArrowRight size={18} />}
              size="lg"
            >
              Iniciar Sesión
            </Button>
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
