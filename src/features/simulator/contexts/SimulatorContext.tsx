'use client';

import React, { createContext, useContext } from 'react';
import { useSimulator as useSimulatorHook } from '../hooks/useSimulator';

const SimulatorContext = createContext<ReturnType<typeof useSimulatorHook> | null>(null);

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const simulator = useSimulatorHook();
    return (
        <SimulatorContext.Provider value={simulator}>
            {children}
        </SimulatorContext.Provider>
    );
};

export const useSimulatorContext = () => {
    const context = useContext(SimulatorContext);
    if (!context) {
        throw new Error('useSimulatorContext must be used within a SimulatorProvider');
    }
    return context;
};
