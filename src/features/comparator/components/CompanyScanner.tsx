import React from 'react';
// Icons removed as they were unused

export const CompanyScanner = () => {
    return (
        <div className="flex items-center gap-4 overflow-hidden py-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Analizando:</span>
            <div className="flex gap-6 animate-marquee">
                {/* Mock Logos using text for now, would replace with SVGs */}
                <span className="font-bold text-slate-700">Endesa</span>
                <span className="font-bold text-slate-700">Iberdrola</span>
                <span className="font-bold text-slate-700">Naturgy</span>
                <span className="font-bold text-slate-700">TotalEnergies</span>
                <span className="font-bold text-slate-700">Repsol</span>
                <span className="font-bold text-slate-700">Holaluz</span>
            </div>
        </div>
    );
};
