import { describe, it, expect } from 'vitest';
import {
    buildConversionMemory,
    getConversionSignal,
    conversionDelta,
    buildOutcomeKey,
    type ProposalOutcome,
} from '../conversionMemory';

const outcome = (
    marketer: string,
    offerType: 'fixed' | 'indexed',
    signal: ProposalOutcome['signal'],
    segment: ProposalOutcome['segment'] = null,
): ProposalOutcome => ({ marketer, offerType, segment, signal });

describe('buildConversionMemory', () => {
    it('returns empty memory for no outcomes', () => {
        // Arrange / Act
        const memory = buildConversionMemory([]);

        // Assert
        expect(memory.totalOutcomes).toBe(0);
        expect(Object.keys(memory.byKey)).toHaveLength(0);
    });

    it('aggregates signals by marketer+type+segment key', () => {
        // Arrange
        const outcomes = [
            outcome('NATURGY', 'fixed', 'chosen', 'PYME'),
            outcome('NATURGY', 'fixed', 'won', 'PYME'),
            outcome('NATURGY', 'fixed', 'lost', 'PYME'),
        ];

        // Act
        const memory = buildConversionMemory(outcomes);
        const stat = memory.byKey[buildOutcomeKey('NATURGY', 'fixed', 'PYME')];

        // Assert
        expect(stat.chosen).toBe(1);
        expect(stat.won).toBe(1);
        expect(stat.lost).toBe(1);
        expect(stat.sampleCount).toBe(3);
    });

    it('gives a score above 0.5 when wins dominate', () => {
        // Arrange: muchas victorias, sin pérdidas
        const outcomes = Array.from({ length: 8 }, () => outcome('ENDESA', 'indexed', 'won'));

        // Act
        const memory = buildConversionMemory(outcomes);
        const stat = memory.byKey[buildOutcomeKey('ENDESA', 'indexed', null)];

        // Assert
        expect(stat.score).toBeGreaterThan(0.5);
        expect(stat.confidence).toBeGreaterThan(0);
    });

    it('gives a score below 0.5 when losses dominate', () => {
        // Arrange
        const outcomes = Array.from({ length: 8 }, () => outcome('REPSOL', 'fixed', 'lost'));

        // Act
        const memory = buildConversionMemory(outcomes);
        const stat = memory.byKey[buildOutcomeKey('REPSOL', 'fixed', null)];

        // Assert
        expect(stat.score).toBeLessThan(0.5);
    });

    it('keeps confidence low with few samples and full with many', () => {
        // Arrange
        const few = buildConversionMemory([outcome('IBERDROLA', 'fixed', 'won')]);
        const many = buildConversionMemory(
            Array.from({ length: 10 }, () => outcome('IBERDROLA', 'fixed', 'won')),
        );

        // Assert
        const fewStat = few.byKey[buildOutcomeKey('IBERDROLA', 'fixed', null)];
        const manyStat = many.byKey[buildOutcomeKey('IBERDROLA', 'fixed', null)];
        expect(fewStat.confidence).toBeLessThan(0.5);
        expect(manyStat.confidence).toBe(1);
    });
});

describe('getConversionSignal', () => {
    it('returns neutral with zero confidence when memory is null', () => {
        // Act
        const signal = getConversionSignal(null, 'NATURGY', 'fixed', 'PYME');

        // Assert
        expect(signal.score).toBe(0.5);
        expect(signal.confidence).toBe(0);
    });

    it('returns neutral when the marketer has no data', () => {
        // Arrange
        const memory = buildConversionMemory([outcome('NATURGY', 'fixed', 'won')]);

        // Act
        const signal = getConversionSignal(memory, 'UNKNOWN_CO', 'fixed', 'PYME');

        // Assert
        expect(signal.confidence).toBe(0);
    });

    it('falls back from segment-specific key to marketer+type key', () => {
        // Arrange: datos sin segmento (clave ANY)
        const memory = buildConversionMemory(
            Array.from({ length: 5 }, () => outcome('ENDESA', 'indexed', 'won')),
        );

        // Act: pedimos con segmento PYME, debe caer al fallback marketer+type
        const signal = getConversionSignal(memory, 'ENDESA', 'indexed', 'PYME');

        // Assert
        expect(signal.confidence).toBeGreaterThan(0);
        expect(signal.score).toBeGreaterThan(0.5);
    });
});

describe('conversionDelta', () => {
    it('is zero when confidence is zero (no data → no effect)', () => {
        // Arrange / Act
        const delta = conversionDelta({ score: 0.9, confidence: 0 }, 0.15);

        // Assert: aunque el score sea alto, sin confianza no afecta
        expect(delta).toBe(0);
    });

    it('is positive for a winning signal with confidence', () => {
        // Act
        const delta = conversionDelta({ score: 1, confidence: 1 }, 0.15);

        // Assert: (1-0.5)*2 * 1 * 0.15 = 0.15
        expect(delta).toBeCloseTo(0.15, 4);
    });

    it('is negative for a losing signal with confidence', () => {
        // Act
        const delta = conversionDelta({ score: 0, confidence: 1 }, 0.15);

        // Assert: (0-0.5)*2 * 1 * 0.15 = -0.15
        expect(delta).toBeCloseTo(-0.15, 4);
    });

    it('scales down with partial confidence', () => {
        // Act
        const delta = conversionDelta({ score: 1, confidence: 0.5 }, 0.15);

        // Assert: 0.15 * 0.5 = 0.075
        expect(delta).toBeCloseTo(0.075, 4);
    });
});
