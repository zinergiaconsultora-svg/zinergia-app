import { Tariff, TariffCsvRow } from '@/types/tariff';

const STORAGE_KEY = 'zinergia_tariffs';

/**
 * Parse a number string that may use European format (comma as decimal)
 */
const parseNumber = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    // Replace comma with dot for European format
    const normalized = val.toString().trim().replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Generate a unique ID
 */
const generateId = (): string => {
    return `tariff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Tariff Service - CRUD operations and CSV import
 */
export const tariffService = {
    /**
     * Get all tariffs from localStorage
     */
    getAll(): Tariff[] {
        if (typeof window === 'undefined') return [];
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        try {
            return JSON.parse(stored) as Tariff[];
        } catch {
            return [];
        }
    },

    /**
     * Save all tariffs to localStorage
     */
    saveAll(tariffs: Tariff[]): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tariffs));
    },

    /**
     * Get a single tariff by ID
     */
    getById(id: string): Tariff | undefined {
        return this.getAll().find(t => t.id === id);
    },

    /**
     * Create a new tariff
     */
    create(input: Omit<Tariff, 'id' | 'updatedAt'>): Tariff {
        const tariff: Tariff = {
            ...input,
            id: generateId(),
            updatedAt: new Date().toISOString(),
        };
        const all = this.getAll();
        all.push(tariff);
        this.saveAll(all);
        return tariff;
    },

    /**
     * Update an existing tariff
     */
    update(id: string, updates: Partial<Tariff>): Tariff | null {
        const all = this.getAll();
        const index = all.findIndex(t => t.id === id);
        if (index === -1) return null;

        all[index] = {
            ...all[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.saveAll(all);
        return all[index];
    },

    /**
     * Delete a tariff
     */
    delete(id: string): boolean {
        const all = this.getAll();
        const filtered = all.filter(t => t.id !== id);
        if (filtered.length === all.length) return false;
        this.saveAll(filtered);
        return true;
    },

    /**
     * Parse CSV string to Tariff array
     */
    parseCsv(csvString: string): Tariff[] {
        const lines = csvString.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const tariffs: Tariff[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 9) continue;

            const row: Record<string, string> = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });

            const csvRow = row as unknown as TariffCsvRow;

            tariffs.push({
                id: generateId(),
                company: csvRow.COMPAÑIA || '',
                name: csvRow.TARIFA || '',
                powerPriceP1: parseNumber(csvRow.PRECIO_POTENCIA_P1),
                powerPriceP2: parseNumber(csvRow.PRECIO_POTENCIA_P2),
                powerPriceP3: parseNumber(csvRow.PRECIO_POTENCIA_P3),
                energyPriceP1: parseNumber(csvRow.PRECIO_ENERGIA_P1),
                energyPriceP2: parseNumber(csvRow.PRECIO_ENERGIA_P2),
                energyPriceP3: parseNumber(csvRow.PRECIO_ENERGIA_P3),
                connectionFee: parseNumber(csvRow.DERECHOS_ENGANCHE),
                updatedAt: new Date().toISOString(),
                isActive: true,
            });
        }

        return tariffs;
    },

    /**
     * Import tariffs from CSV file
     */
    async importFromFile(file: File): Promise<{ imported: number; total: number }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvString = e.target?.result as string;
                    const parsed = this.parseCsv(csvString);

                    // Merge with existing (replace by company+name key)
                    const existing = this.getAll();
                    const existingKeys = new Set(existing.map(t => `${t.company}|${t.name}`));

                    let imported = 0;
                    parsed.forEach(newTariff => {
                        const key = `${newTariff.company}|${newTariff.name}`;
                        if (!existingKeys.has(key)) {
                            existing.push(newTariff);
                            imported++;
                        }
                    });

                    this.saveAll(existing);
                    resolve({ imported, total: parsed.length });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    },

    /**
     * Import tariffs from CSV string (for initial setup)
     */
    importFromString(csvString: string): { imported: number; total: number } {
        const parsed = this.parseCsv(csvString);
        const existing = this.getAll();
        const existingKeys = new Set(existing.map(t => `${t.company}|${t.name}`));

        let imported = 0;
        parsed.forEach(newTariff => {
            const key = `${newTariff.company}|${newTariff.name}`;
            if (!existingKeys.has(key)) {
                existing.push(newTariff);
                imported++;
            }
        });

        this.saveAll(existing);
        return { imported, total: parsed.length };
    },

    /**
     * Clear all tariffs
     */
    clearAll(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_KEY);
    },

    /**
     * Calculate annual cost for given consumption using a tariff
     */
    calculateAnnualCost(
        tariff: Tariff,
        powerKw: { p1: number; p2: number; p3: number },
        energyKwh: { p1: number; p2: number; p3: number },
        daysPerYear: number = 365
    ): number {
        // Power cost (€/kW/día * kW * días)
        const powerCost =
            (tariff.powerPriceP1 * powerKw.p1 * daysPerYear) +
            (tariff.powerPriceP2 * powerKw.p2 * daysPerYear) +
            (tariff.powerPriceP3 * powerKw.p3 * daysPerYear);

        // Energy cost (€/kWh * kWh * 12 months)
        const energyCost =
            (tariff.energyPriceP1 * energyKwh.p1 * 12) +
            (tariff.energyPriceP2 * energyKwh.p2 * 12) +
            (tariff.energyPriceP3 * energyKwh.p3 * 12);

        // Connection fee (monthly * 12)
        const connectionCost = tariff.connectionFee * 12;

        return powerCost + energyCost + connectionCost;
    },

    /**
     * Find best tariffs for given consumption
     */
    findBestTariffs(
        powerKw: { p1: number; p2: number; p3: number },
        energyKwh: { p1: number; p2: number; p3: number },
        limit: number = 5
    ): Array<{ tariff: Tariff; annualCost: number }> {
        const tariffs = this.getAll().filter(t => t.isActive);

        const withCosts = tariffs.map(tariff => ({
            tariff,
            annualCost: this.calculateAnnualCost(tariff, powerKw, energyKwh),
        }));

        return withCosts
            .sort((a, b) => a.annualCost - b.annualCost)
            .slice(0, limit);
    },
};
