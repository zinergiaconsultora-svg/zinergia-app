import React from 'react';
import { cn } from '@/lib/utils';

interface AmbientBackgroundProps {
    className?: string;
}

export function AmbientBackground({ className }: AmbientBackgroundProps) {
    return (
        <div className={cn("fixed inset-0 pointer-events-none z-0", className)}>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-energy-200/40 rounded-full blur-[120px] mix-blend-multiply opacity-50 animate-blob"></div>
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-blue/10 rounded-full blur-[120px] mix-blend-multiply opacity-50 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[10%] w-[60%] h-[60%] bg-energy-100/40 rounded-full blur-[120px] mix-blend-multiply opacity-50 animate-blob animation-delay-4000"></div>
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-soft-light"></div>
        </div>
    );
}
