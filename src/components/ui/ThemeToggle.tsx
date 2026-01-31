'use client';

import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const themes: { value: 'light' | 'dark' | 'system'; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun size={16} />, label: 'Claro' },
    { value: 'dark', icon: <Moon size={16} />, label: 'Oscuro' },
    { value: 'system', icon: <Monitor size={16} />, label: 'Sistema' },
  ];

  const currentIcon = themes.find(t => t.value === theme)?.icon;

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-energy-500"
        aria-label="Cambiar tema"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {currentIcon}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-20"
              role="menu"
              aria-label="Opciones de tema"
            >
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setTheme(t.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    theme === t.value
                      ? 'bg-energy-50 dark:bg-energy-900/20 text-energy-700 dark:text-energy-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  role="menuitem"
                  aria-current={theme === t.value ? 'true' : undefined}
                >
                  <span className="flex-shrink-0">{t.icon}</span>
                  <span className="flex-1 text-left">{t.label}</span>
                  {theme === t.value && (
                    <motion.span
                      layoutId="activeTheme"
                      className="w-1.5 h-1.5 rounded-full bg-energy-600 dark:bg-energy-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
