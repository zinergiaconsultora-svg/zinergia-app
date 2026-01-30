/**
 * Share Simulation Results
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, CheckCircle2, Copy, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ShareResultsProps {
    simulationId: string;
    invoiceData: any;
    results: any[];
}

export const ShareResults: React.FC<ShareResultsProps> = ({ simulationId, invoiceData, results }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [expiresIn, setExpiresIn] = useState('7'); // days

    const generateShareLink = async () => {
        const supabase = createClient();
        
        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));

        try {
            // Create share record
            const { data, error } = await supabase
                .from('shared_simulations')
                .insert({
                    simulation_id: simulationId,
                    expires_at: expiresAt.toISOString(),
                    // Generate unique slug
                    slug: Math.random().toString(36).substring(2, 10),
                })
                .select('slug')
                .single();

            if (error) throw error;

            const link = `${window.location.origin}/share/${data.slug}`;
            setShareLink(link);
        } catch (error) {
            console.error('Error generating share link:', error);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (!shareLink) {
            await generateShareLink();
        }
    };

    if (!isOpen) {
        return (
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
                <Share2 className="w-5 h-5" />
                Compartir
            </motion.button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsOpen(false)}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-purple-600" />
                        Compartir Resultados
                    </h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Expiration */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Expira en
                    </label>
                    <select
                        value={expiresIn}
                        onChange={(e) => setExpiresIn(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="1">1 día</option>
                        <option value="7">7 días</option>
                        <option value="30">30 días</option>
                        <option value="90">90 días</option>
                    </select>
                </div>

                {/* Generate Link */}
                {!shareLink ? (
                    <button
                        onClick={handleShare}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors"
                    >
                        Generar Link de Compartir
                    </button>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-sm font-medium">Link generado exitosamente</span>
                        </div>

                        {/* Link Display */}
                        <div className="relative">
                            <input
                                type="text"
                                value={shareLink}
                                readOnly
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg pr-24 text-sm font-mono text-slate-600"
                            />
                            <button
                                onClick={copyToClipboard}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Copiado
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        Copiar
                                    </>
                                )}
                            </button>
                        </div>

                        {/* QR Code (bonus) */}
                        <div className="flex justify-center p-4 bg-slate-50 rounded-lg">
                            <div className="text-center">
                                <p className="text-xs text-slate-500 mb-2">Escanea para ver</p>
                                <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center">
                                    <QRCodeSVG shareLink={shareLink} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                    <p className="text-xs text-slate-500 text-center">
                        El link expirará automáticamente después del tiempo seleccionado. 
                        Anyone con el link podrá ver los resultados de la comparación.
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

// Simple QR Code SVG component
function QRCodeSVG({ shareLink }: { shareLink: string }) {
    // This would normally use a QR code library, but for simplicity we'll use a placeholder
    return (
        <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="w-full h-full"
        >
            <rect width="120" height="120" fill="white" />
            <text x="60" y="65" textAnchor="middle" fontSize="10" fill="#333">
                QR Code
            </text>
            <text x="60" y="80" textAnchor="middle" fontSize="8" fill="#666">
                {shareLink.slice(0, 20)}...
            </text>
        </svg>
    );
}
