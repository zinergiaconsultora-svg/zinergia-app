'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MagneticCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function MagneticCard({ children, className = "", onClick }: MagneticCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    
    // Gloss parameters for mobile (Gyroscope)
    const [gyroX, setGyroX] = useState(50);
    const [gyroY, setGyroY] = useState(50);

    // Mouse Tracking (Desktop)
    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePosition({ x, y });
    }

    // Gyroscope Tracking (Mobile)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        // Solo aplicar si no pueden usar hover (móvil)
        if (window.matchMedia("(hover: hover)").matches) return;

        const handleOrientation = (e: DeviceOrientationEvent) => {
            const beta = e.beta || 0; // -180 to 180 (front to back)
            const gamma = e.gamma || 0; // -90 to 90 (left to right)
            
            // Map degrees to percentage for gradient 
            // Neutro (plano) suele ser beta ~45 en la mano, gamma 0
            const x = Math.min(Math.max(((gamma + 45) / 90) * 100, 0), 100);
            const y = Math.min(Math.max(((beta) / 90) * 100, 0), 100);
            
            setGyroX(x);
            setGyroY(y);
        };

        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, []);

    const isMobile = typeof window !== 'undefined' && !window.matchMedia("(hover: hover)").matches;
    
    return (
        <motion.div
            ref={cardRef}
            whileTap={{ scale: 0.96 }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            className={`relative overflow-hidden cursor-pointer ${className}`}
        >
            {/* Contenido principal */}
            <div className="relative z-10 w-full h-full pointer-events-none">
                {children}
            </div>

            {/* Efecto Magnético / Reflejo Apple Card */}
            {isHovered && !isMobile && (
                <div
                    className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.4), transparent 40%)`
                    }}
                />
            )}
            
            {/* Efecto Giroscopio en Móvil */}
            {isMobile && (
                <div 
                    className="pointer-events-none absolute inset-0 z-20 opacity-30 mix-blend-overlay transition-all duration-100 ease-out"
                    style={{
                        background: `radial-gradient(150% 150% at ${gyroX}% ${gyroY}%, rgba(255,255,255,1), transparent 50%)`
                    }}
                />
            )}
            
            {/* Borde brillante constante */}
            <div className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] border border-white/20 dark:border-white/10 mix-blend-overlay"></div>
        </motion.div>
    );
}
