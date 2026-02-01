'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                    <div className="w-full max-w-md bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl p-6">
                        <ErrorState
                            title="¡Vaya! Algo salió mal"
                            description="Ha ocurrido un error inesperado al renderizar la aplicación. Hemos notificado al equipo técnico."
                            retry={() => this.setState({ hasError: false })}
                            home={true}
                        />
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-xs font-mono text-red-600 overflow-auto max-h-40">
                                {this.state.error.toString()}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
