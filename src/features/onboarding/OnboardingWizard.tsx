'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { getAgentProfileAction, AgentProfile } from '@/app/actions/profile';

import { StepWelcome, StepProfile, StepHowItWorks, StepReady, SLIDE, FloatingOrbs, StepDots, STORAGE_KEY } from './OnboardingScreens';

export function OnboardingWizard() {
    const router = useRouter();
    const [profile, setProfile] = useState<AgentProfile | null>(null);
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);
    const [currentName, setCurrentName] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (localStorage.getItem(STORAGE_KEY)) return;

        getAgentProfileAction().then(p => {
            if (!p) return;
            if (p.role === 'agent' && !p.full_name) {
                setProfile(p);
                setShow(true);
            }
        }).catch(() => { });
    }, []);

    const done = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setShow(false);
    };

    const goTo = (next: number) => {
        setDir(next > step ? 1 : -1);
        setStep(next);
    };

    const handleNavigate = (href: string) => {
        done();
        router.push(href);
    };

    if (!show || !profile) return null;

    const TOTAL_STEPS = 4;

    return (
        <>
            {/* Floating blobs behind everything */}
            <FloatingOrbs />

            <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-slate-950/88 backdrop-blur-md"
                    aria-hidden="true"
                />

                {/* Card — bottom sheet on mobile, centered modal on sm+ */}
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="onboarding-title"
                    initial={{ opacity: 0, y: 32, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                    className="relative z-10 w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-t border-x sm:border border-white/8"
                >
                    {/* Gradient accent bar at top */}
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

                    {/* Drag handle (mobile only) */}
                    <div className="sm:hidden flex justify-center pt-3 pb-0">
                        <div className="w-10 h-1 rounded-full bg-slate-700" />
                    </div>

                    {/* Skip button */}
                    {step < 3 && (
                        <button
                            type="button"
                            onClick={done}
                            aria-label="Cerrar asistente de bienvenida"
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            <X size={15} />
                        </button>
                    )}

                    {/* Scrollable inner area (important on small phones) */}
                    <div className="px-6 pb-6 pt-5 sm:p-7 overflow-y-auto max-h-[90dvh]">
                        <StepDots total={TOTAL_STEPS} current={step} />

                        <AnimatePresence mode="wait" custom={dir}>
                            <motion.div
                                key={step}
                                custom={dir}
                                variants={SLIDE}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.22, ease: 'easeInOut' }}
                            >
                                {step === 0 && (
                                    <StepWelcome profile={profile} onNext={() => goTo(1)} onSkip={done} />
                                )}
                                {step === 1 && (
                                    <StepProfile
                                        profile={profile}
                                        onNext={({ full_name }) => { setCurrentName(full_name); goTo(2); }}
                                        onBack={() => goTo(0)}
                                    />
                                )}
                                {step === 2 && (
                                    <StepHowItWorks onNext={() => goTo(3)} onBack={() => goTo(1)} />
                                )}
                                {step === 3 && (
                                    <StepReady
                                        name={currentName || profile.email || 'agente'}
                                        onDone={done}
                                        onNavigate={handleNavigate}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </>
    );
}
