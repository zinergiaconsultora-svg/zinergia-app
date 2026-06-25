import { describe, it, expect } from 'vitest';
import {
    analyzeConsumptionProfile,
    recommendContractingStrategy,
    analyzeConsumption,
} from '../consumptionProfile';
import { InvoiceData } from '../types';

// Factura mínima parametrizable para los tests.
const mockInvoice = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({
    period_start: '2024-01-01',
    period_end: '2024-01-31',
    days_involced: 30,
    tariff_type: '2.0TD',
    contracted_power: { p1: 10, p2: 10, p3: 10, p4: 0, p5: 0, p6: 0 },
    max_demand: { p1: 8, p2: 8, p3: 8, p4: 0, p5: 0, p6: 0 },
    energy_consumption: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
    current_cost_power: 50,
    current_cost_energy: 50,
    current_cost_reactive: 0,
    current_cost_rental: 1,
    current_total_tax_excluded: 101,
    ...overrides,
});

describe('analyzeConsumptionProfile', () => {
    it('computes load factor as average demand over peak demand', () => {
        // Arrange: 7200 kWh over 30 days = 10 kW avg; peak (maxímetro) = 10 kW → LF = 1.0 clamped.
        // Use peak 20 to get a clean 0.5 load factor.
        const data = mockInvoice({
            days_involced: 30,
            max_demand: { p1: 20, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
            energy_consumption: { p1: 3600, p2: 1800, p3: 1800, p4: 0, p5: 0, p6: 0 }, // 7200 kWh
        });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert: avg = 7200 / (30*24) = 10 kW; LF = 10 / 20 = 0.5
        expect(profile.avgKw).toBeCloseTo(10, 3);
        expect(profile.peakKw).toBe(20);
        expect(profile.loadFactor).toBeCloseTo(0.5, 3);
        expect(profile.loadFactorPct).toBe(50);
        expect(profile.classification).toBe('moderate');
    });

    it('classifies a flat profile when load factor is high', () => {
        // Arrange: peak barely above average → high load factor.
        const data = mockInvoice({
            max_demand: { p1: 11, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
            energy_consumption: { p1: 2400, p2: 2400, p3: 2400, p4: 0, p5: 0, p6: 0 }, // 7200 kWh, avg 10kW
        });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert
        expect(profile.loadFactor).toBeGreaterThanOrEqual(0.6);
        expect(profile.classification).toBe('flat');
    });

    it('classifies a peaky profile when load factor is low', () => {
        // Arrange: high peak vs low average.
        const data = mockInvoice({
            max_demand: { p1: 50, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
            energy_consumption: { p1: 1000, p2: 500, p3: 500, p4: 0, p5: 0, p6: 0 }, // 2000 kWh, avg ~2.78kW
        });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert
        expect(profile.loadFactor).toBeLessThan(0.35);
        expect(profile.classification).toBe('peaky');
    });

    it('falls back to contracted power when no maxímetro is present', () => {
        // Arrange
        const data = mockInvoice({
            max_demand: undefined,
            contracted_power: { p1: 15, p2: 15, p3: 15, p4: 0, p5: 0, p6: 0 },
            energy_consumption: { p1: 3600, p2: 1800, p3: 1800, p4: 0, p5: 0, p6: 0 },
        });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert: peak taken from contracted power
        expect(profile.peakKw).toBe(15);
        expect(profile.powerOvercontracted).toBe(false); // no max_demand → cannot assert overcontract
    });

    it('flags overcontracted power when contracted greatly exceeds maxímetro', () => {
        // Arrange: contracted 15 kW, real peak demand 8 kW (15 > 8 * 1.2).
        const data = mockInvoice({
            contracted_power: { p1: 15, p2: 15, p3: 15, p4: 0, p5: 0, p6: 0 },
            max_demand: { p1: 8, p2: 8, p3: 8, p4: 0, p5: 0, p6: 0 },
            energy_consumption: { p1: 1000, p2: 1000, p3: 1000, p4: 0, p5: 0, p6: 0 },
        });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert
        expect(profile.powerOvercontracted).toBe(true);
        expect(profile.narrative).toContain('potencia contratada');
    });

    it('uses P6 as the valley period for 3.0TD', () => {
        // Arrange
        const data = mockInvoice({
            tariff_type: '3.0TD',
            energy_consumption: { p1: 100, p2: 100, p3: 100, p4: 100, p5: 100, p6: 500 },
        });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert: 500 / 1000 = 0.5 valley ratio
        expect(profile.valleyRatio).toBeCloseTo(0.5, 3);
    });

    it('returns zero load factor safely when there is no consumption', () => {
        // Arrange
        const data = mockInvoice({ energy_consumption: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 } });

        // Act
        const profile = analyzeConsumptionProfile(data);

        // Assert
        expect(profile.loadFactor).toBe(0);
        expect(profile.avgKw).toBe(0);
    });
});

describe('recommendContractingStrategy', () => {
    it('recommends precio fijo for daytime-concentrated low-valley consumption', () => {
        // Arrange
        const data = mockInvoice({
            energy_consumption: { p1: 500, p2: 400, p3: 100, p4: 0, p5: 0, p6: 0 }, // 90% P1+P2
        });
        const profile = analyzeConsumptionProfile(data);

        // Act
        const strategy = recommendContractingStrategy(profile);

        // Assert
        expect(strategy.strategy).toBe('fijo');
        expect(strategy.confidence).toBe('alta');
        expect(strategy.rationale.length).toBeGreaterThan(0);
    });

    it('recommends indexado when most consumption is in the valley period', () => {
        // Arrange: 3.0TD with heavy P6 (valley).
        const data = mockInvoice({
            tariff_type: '3.0TD',
            energy_consumption: { p1: 100, p2: 100, p3: 50, p4: 50, p5: 50, p6: 650 }, // 65% valley
        });
        const profile = analyzeConsumptionProfile(data);

        // Act
        const strategy = recommendContractingStrategy(profile);

        // Assert
        expect(strategy.strategy).toBe('indexado');
        expect(strategy.label).toContain('OMIE');
    });

    it('recommends fijo con discriminación horaria for a mixed profile', () => {
        // Arrange: spread-out consumption, no dominant period, moderate load factor.
        const data = mockInvoice({
            tariff_type: '3.0TD',
            max_demand: { p1: 20, p2: 20, p3: 20, p4: 20, p5: 20, p6: 20 },
            energy_consumption: { p1: 200, p2: 150, p3: 150, p4: 150, p5: 150, p6: 300 }, // valley 30%, business 35%
        });
        const profile = analyzeConsumptionProfile(data);

        // Act
        const strategy = recommendContractingStrategy(profile);

        // Assert
        expect(strategy.strategy).toBe('fijo_discriminacion');
    });
});

describe('analyzeConsumption', () => {
    it('returns both profile and strategy together', () => {
        // Arrange
        const data = mockInvoice({
            energy_consumption: { p1: 500, p2: 400, p3: 100, p4: 0, p5: 0, p6: 0 },
        });

        // Act
        const analysis = analyzeConsumption(data);

        // Assert
        expect(analysis.profile).toBeDefined();
        expect(analysis.strategy).toBeDefined();
        expect(analysis.profile.loadFactorPct).toBeGreaterThanOrEqual(0);
    });
});
