import React from 'react';
import Image from 'next/image';

export const ZinergiaLogo: React.FC<{ className?: string }> = ({ className = "w-32" }) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="relative w-full aspect-video">
                <Image
                    src="/logo.png"
                    alt="Zinergia Logo"
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    priority
                    className="object-contain"
                />
            </div>
        </div>
    );
};
