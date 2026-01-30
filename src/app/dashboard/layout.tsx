'use client';

import React from 'react';
import { NavigationSidebar } from '@/components/NavigationSidebar';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 gradient-organic relative selection:bg-indigo-100 dark:selection:bg-indigo-900 text-slate-900 dark:text-slate-100 font-sans">
            {/* Desktop Sidebar */}
            <NavigationSidebar />

            {/* Mobile Nav Header - Simplified & cleaner */}
            <header className="lg:hidden h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-lg">N</span>
                    <span className="font-bold text-slate-900 tracking-tight text-lg">Nexus</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 -mr-2 text-slate-500 hover:text-slate-900 transition-colors active:scale-95"
                    title="Menu"
                >
                    <Menu size={24} />
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-y-0 left-0 w-[85%] max-w-[320px] bg-white z-[60] lg:hidden shadow-2xl flex flex-col h-full"
                        >
                            <div className="p-6 flex justify-between items-center border-b border-slate-50 bg-slate-50/50">
                                <span className="font-black text-slate-900 tracking-tighter text-xl">Menú</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 -mr-2 text-slate-400 hover:text-slate-900 transition-colors"
                                    aria-label="Cerrar menú"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Wrapper to reuse Sidebar content but ensure it takes full height */}
                            <div className="flex-1 overflow-hidden">
                                <NavigationSidebar isMobile={true} onItemClick={() => setIsMobileMenuOpen(false)} />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="lg:pl-[280px] min-h-screen pb-24 lg:pb-12 transition-all duration-300">
                <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12 animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
