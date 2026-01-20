import React, { ElementType } from 'react';

interface TypographyProps {
    children: React.ReactNode;
    className?: string;
    as?: ElementType;
}

// 1. H1 - TÍTULOS DE PÁGINA (Compact & Strong)
export const PageTitle: React.FC<TypographyProps> = ({ children, className = "", as: Component = "h1" }) => {
    return (
        <Component className={`text-2xl font-bold tracking-tight leading-tight text-slate-900 dark:text-slate-50 ${className}`}>
            {children}
        </Component>
    );
};

// 2. H2 - SUBTÍTULOS DE TARJETA (Clean & Sharp)
export const CardTitle: React.FC<TypographyProps> = ({ children, className = "", as: Component = "h2" }) => {
    return (
        <Component className={`text-base font-semibold tracking-normal leading-6 text-slate-900 dark:text-slate-100 ${className}`}>
            {children}
        </Component>
    );
};

// 3. BODY UI - TEXTO DE INTERFAZ (The Workhorse)
export const BodyText: React.FC<TypographyProps> = ({ children, className = "", as: Component = "p" }) => {
    return (
        <Component className={`text-sm font-normal leading-5 text-slate-700 dark:text-slate-300 ${className}`}>
            {children}
        </Component>
    );
};

// 4. BODY READING - TEXTO DE LECTURA (Paragraphs)
export const Paragraph: React.FC<TypographyProps> = ({ children, className = "", as: Component = "p" }) => {
    return (
        <Component className={`text-sm font-normal leading-relaxed text-slate-600 dark:text-slate-400 ${className}`}>
            {children}
        </Component>
    );
};

// 5. MICRO-CAPTION - METADATOS (Technical Look)
export const Micro: React.FC<TypographyProps> = ({ children, className = "", as: Component = "span" }) => {
    return (
        <Component className={`text-xs font-medium tracking-wide text-slate-500 uppercase ${className}`}>
            {children}
        </Component>
    );
};
