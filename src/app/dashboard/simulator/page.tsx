'use client';

import { SimulatorView } from '@/features/simulator/components/SimulatorView';
import { SimulatorProvider } from '@/features/simulator/contexts/SimulatorContext';

export default function SimulatorPage() {
    return (
        <SimulatorProvider>
            <SimulatorView />
        </SimulatorProvider>
    );
}