'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0.65 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.65 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full w-full"
        >
            {children}
        </motion.div>
    );
}
