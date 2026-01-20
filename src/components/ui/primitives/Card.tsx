import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = "",
    onClick,
    noPadding = false
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                bg-white dark:bg-slate-900 
                border border-slate-200 dark:border-slate-800 
                rounded-[2rem] shadow-sm 
                transition-all duration-300
                ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]' : ''}
                ${noPadding ? '' : 'p-6'}
                ${className}
            `}
        >
            {children}
        </div>
    );
};
