'use client';

import { motion } from 'framer-motion';

// Puntos predefinidos que simulan una tendencia al alza (Ahorro/Pipeline)
const upTrendPoints = "M 0 20 Q 15 10, 30 15 T 60 5 T 90 10 T 120 0";

interface AnimatedSparklineProps {
    color?: string;
    strokeWidth?: number;
    className?: string;
    delay?: number;
}

export function AnimatedSparkline({
    color = "currentColor",
    strokeWidth = 2,
    className = "",
    delay = 0.2
}: AnimatedSparklineProps) {
    return (
        <svg
            className={`w-full h-8 overflow-visible mt-2 ${className}`}
            viewBox="0 0 120 20"
            preserveAspectRatio="none"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <motion.path
                d={upTrendPoints}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                    pathLength: { delay, type: "spring", duration: 1.5, bounce: 0 },
                    opacity: { delay, duration: 0.1 }
                }}
            />
            {/* Gradiente relleno inferior para efecto sombra */}
            <motion.path
                d={`${upTrendPoints} L 120 30 L 0 30 Z`}
                fill={`url(#gradient-${color.replace('#', '')})`}
                stroke="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                transition={{ delay: delay + 0.3, duration: 1 }}
            />
            <defs>
                <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="1" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
}
