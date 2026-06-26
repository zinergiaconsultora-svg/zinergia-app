import { describe, it, expect } from 'vitest';
import { detectSupplyMemoryAnomalies, type EnergyHistoryEntry } from '../anomalyDetector';

const history = (...vals: number[]): EnergyHistoryEntry[] =>
    vals.map((totalEnergy, i) => ({
        month: `2024-${String(i + 1).padStart(2, '0')}`,
        totalEnergy,
    }));

const NORMAL_PERIOD = 30;

describe('detectSupplyMemoryAnomalies', () => {
    it('returns nothing when current energy is zero', () => {
        expect(detectSupplyMemoryAnomalies(0, NORMAL_PERIOD, history(500, 500, 500))).toHaveLength(0);
    });

    it('returns nothing without enough history', () => {
        // Solo 1 mes → no hay media fiable
        expect(detectSupplyMemoryAnomalies(900, NORMAL_PERIOD, history(500))).toHaveLength(0);
    });

    it('flags a likely OCR error when consumption is far above the historical pattern', () => {
        // Arrange: media ~500, lectura 2000 (>3×)
        const result = detectSupplyMemoryAnomalies(2000, NORMAL_PERIOD, history(500, 500, 500));

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('ocr_consumption_outlier');
        expect(result[0].severity).toBe('critical');
    });

    it('flags a likely OCR error when consumption is far below the historical pattern', () => {
        const result = detectSupplyMemoryAnomalies(100, NORMAL_PERIOD, history(500, 500, 500));
        expect(result[0].id).toBe('ocr_consumption_outlier');
    });

    it('does not emit other memory signals when an OCR outlier is detected', () => {
        // Un outlier corta el resto de señales para no confundir
        const result = detectSupplyMemoryAnomalies(2000, NORMAL_PERIOD, history(500, 500, 500));
        expect(result).toHaveLength(1);
    });

    it('warns on a significant consumption jump up (normal period)', () => {
        // Arrange: media 500, actual 800 (+60%), dentro de rango OCR (<3×)
        const result = detectSupplyMemoryAnomalies(800, NORMAL_PERIOD, history(500, 500));

        // Assert
        expect(result.some(a => a.id === 'consumption_jump_up')).toBe(true);
        expect(result.find(a => a.id === 'consumption_jump_up')?.severity).toBe('warning');
    });

    it('flags a consumption drop as info', () => {
        const result = detectSupplyMemoryAnomalies(250, NORMAL_PERIOD, history(500, 500));
        expect(result.some(a => a.id === 'consumption_jump_down')).toBe(true);
    });

    it('does not evaluate the jump on an abnormal billing period', () => {
        // Período corto (10 días): el salto es esperable, no se evalúa
        const result = detectSupplyMemoryAnomalies(800, 10, history(500, 500));
        expect(result.some(a => a.id.startsWith('consumption_jump'))).toBe(false);
    });

    it('detects a sustained upward trend as an opportunity', () => {
        // Arrange: 3 meses crecientes (300→400→500), actual cerca de la media → sin salto/outlier
        const result = detectSupplyMemoryAnomalies(410, NORMAL_PERIOD, history(300, 400, 500));

        // Assert
        const trend = result.find(a => a.id === 'consumption_trend_up');
        expect(trend).toBeDefined();
        expect(trend?.severity).toBe('info');
    });

    it('does not flag a trend when consumption is flat', () => {
        const result = detectSupplyMemoryAnomalies(500, NORMAL_PERIOD, history(500, 500, 500));
        expect(result.some(a => a.id === 'consumption_trend_up')).toBe(false);
    });
});
