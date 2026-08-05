import { describe, expect, it } from 'vitest';

import {
    calculateCollaboratorCommission,
    formatRate,
    parseRatePercent,
} from '../collaboratorCommission';

describe('calculateCollaboratorCommission', () => {
    it('aplica el porcentaje del colaborador', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 120, rateBps: 6000 });

        expect(r.fromRate).toBe(72);
        expect(r.total).toBe(72);
        expect(r.companyShare).toBe(48);
        expect(r.missingRate).toBe(false);
    });

    it('suma el extra en euros', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 120, rateBps: 6000, extraAmount: 50 });

        expect(r.fromRate).toBe(72);
        expect(r.fromExtra).toBe(50);
        expect(r.total).toBe(122);
    });

    it('lo normal es no llevar extra', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 200, rateBps: 5000 });

        expect(r.fromExtra).toBe(0);
        expect(r.total).toBe(100);
    });

    it('redondea a céntimos', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 99.99, rateBps: 3333 });

        expect(r.fromRate).toBe(33.33);
    });

    it('el 100 % deja a la empresa a cero', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 80, rateBps: 10000 });

        expect(r.total).toBe(80);
        expect(r.companyShare).toBe(0);
    });

    // Un número negativo aquí acabaría en una liquidación como si el colaborador
    // debiera dinero a la empresa.
    it('la parte de la empresa nunca es negativa aunque el extra se pase', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 100, rateBps: 8000, extraAmount: 500 });

        expect(r.total).toBe(580);
        expect(r.companyShare).toBe(0);
    });

    // Sin porcentaje configurado no se inventa uno: ni cero ni un valor por
    // defecto. Ambos pagarían mal en silencio.
    it('avisa cuando el colaborador no tiene porcentaje, en vez de pagar cero calladamente', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 120, rateBps: null });

        expect(r.missingRate).toBe(true);
        expect(r.fromRate).toBe(0);
        expect(r.companyShare).toBe(120);
    });

    it('sin porcentaje pero con extra, el extra se respeta', () => {
        const r = calculateCollaboratorCommission({ grossCommission: 120, rateBps: null, extraAmount: 30 });

        expect(r.missingRate).toBe(true);
        expect(r.total).toBe(30);
    });

    it('trata los importes imposibles como cero en vez de propagar NaN', () => {
        const r = calculateCollaboratorCommission({ grossCommission: Number.NaN, rateBps: 5000 });

        expect(r.total).toBe(0);
        expect(Number.isNaN(r.companyShare)).toBe(false);
    });

    it('no acepta comisiones ni extras negativos', () => {
        const r = calculateCollaboratorCommission({ grossCommission: -100, rateBps: 5000, extraAmount: -20 });

        expect(r.total).toBe(0);
        expect(r.companyShare).toBe(0);
    });

    it('recorta un porcentaje fuera de rango en vez de multiplicar de más', () => {
        expect(calculateCollaboratorCommission({ grossCommission: 100, rateBps: 20000 }).total).toBe(100);
        expect(calculateCollaboratorCommission({ grossCommission: 100, rateBps: -500 }).total).toBe(0);
    });
});

describe('formatRate', () => {
    it('muestra el porcentaje de forma legible', () => {
        expect(formatRate(6500)).toBe('65 %');
        expect(formatRate(6550)).toBe('65.50 %');
        expect(formatRate(0)).toBe('0 %');
    });

    // "Sin configurar" es lo mismo que dice el comparador ante una tarifa sin
    // comisión: el comercial ya sabe leerlo.
    it('dice "Sin configurar" cuando no hay porcentaje', () => {
        expect(formatRate(null)).toBe('Sin configurar');
        expect(formatRate(undefined)).toBe('Sin configurar');
    });
});

describe('parseRatePercent', () => {
    it('convierte lo que se escribe a puntos básicos', () => {
        expect(parseRatePercent(65)).toBe(6500);
        expect(parseRatePercent('65')).toBe(6500);
        expect(parseRatePercent('65.5')).toBe(6550);
        expect(parseRatePercent('0')).toBe(0);
        expect(parseRatePercent('100')).toBe(10000);
    });

    it('acepta la coma decimal, que es como se escribe aquí', () => {
        expect(parseRatePercent('65,5')).toBe(6550);
    });

    it('rechaza lo que no es un porcentaje válido', () => {
        expect(parseRatePercent('')).toBeNull();
        expect(parseRatePercent('abc')).toBeNull();
        expect(parseRatePercent(-1)).toBeNull();
        expect(parseRatePercent(101)).toBeNull();
    });
});
