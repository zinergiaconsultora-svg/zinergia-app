import React from 'react';
import { cn } from '@/lib/utils';

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
            className={cn(
                "glass-premium rounded-3xl transition-all duration-300",
                onClick && "cursor-pointer hover:shadow-floating hover:-translate-y-1 active:scale-[0.99]",
                !noPadding && "p-6 md:p-8",
                className
            )}
        >
            {children}
        </div>
    );
};
