'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ ease: 'easeInOut', duration: 0.4 }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
}
