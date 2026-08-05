import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    DISTRIBUTORS_BY_CUPS_PREFIX,
    getCupsDistributorPrefix,
    getDistributorForCups,
} from '../distributors';

describe('getCupsDistributorPrefix', () => {
    it('extrae los cuatro dígitos posteriores a ES', () => {
        expect(getCupsDistributorPrefix('ES0021000000000000AB')).toBe('ES0021');
    });

    it('normaliza minúsculas y espacios antes de extraer', () => {
        expect(getCupsDistributorPrefix('  es0031 000000000000ab ')).toBe('ES0031');
    });

    it('devuelve null cuando el CUPS no empieza por ES y cuatro dígitos', () => {
        expect(getCupsDistributorPrefix('PT0021000000000000AB')).toBeNull();
        expect(getCupsDistributorPrefix('ES00')).toBeNull();
        expect(getCupsDistributorPrefix('')).toBeNull();
    });
});

describe('getDistributorForCups', () => {
    it('resuelve las distribuidoras mayoritarias', () => {
        expect(getDistributorForCups('ES0021000000000000AB')).toBe('i-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U');
        expect(getDistributorForCups('ES0031000000000000AB')).toBe('EDISTRIBUCIÓN REDES DIGITALES S.L.U.');
        expect(getDistributorForCups('ES0022000000000000AB')).toBe('UFD DISTRIBUCIÓN ELECTRICIDAD, SA');
    });

    it('resuelve también distribuidoras pequeñas', () => {
        expect(getDistributorForCups('ES0122000000000000AB')).toBe('BASSOLS ENERGÍA, S.A');
    });

    // Un prefijo desconocido debe quedarse en blanco, nunca resolverse a otra
    // distribuidora: una distribuidora equivocada en una propuesta es peor que
    // ninguna.
    it('devuelve null para un prefijo que no consta en la tabla', () => {
        expect(getDistributorForCups('ES9999000000000000AB')).toBeNull();
    });

    it('devuelve null para una entrada vacía o inválida', () => {
        expect(getDistributorForCups('')).toBeNull();
        expect(getDistributorForCups('no es un cups')).toBeNull();
    });
});

describe('DISTRIBUTORS_BY_CUPS_PREFIX', () => {
    it('tiene todas las claves con el formato ES + cuatro dígitos', () => {
        const invalid = Object.keys(DISTRIBUTORS_BY_CUPS_PREFIX).filter(key => !/^ES\d{4}$/.test(key));
        expect(invalid).toEqual([]);
    });

    it('no tiene nombres vacíos', () => {
        const empty = Object.entries(DISTRIBUTORS_BY_CUPS_PREFIX)
            .filter(([, name]) => name.trim().length === 0)
            .map(([prefix]) => prefix);
        expect(empty).toEqual([]);
    });

    it('cubre el catálogo completo de distribuidoras conocidas', () => {
        expect(Object.keys(DISTRIBUTORS_BY_CUPS_PREFIX).length).toBeGreaterThanOrEqual(300);
    });
});

// El módulo se usa desde componentes de cliente. `./sips` importa `node:crypto`
// para firmar OAuth contra la CNMC, así que importarlo desde aquí rompería el
// bundle del navegador. La duplicación de `normalizeCups` es deliberada.
describe('aislamiento del bundle de cliente', () => {
    it('no importa nada de sips ni de módulos de node', () => {
        const source = readFileSync(path.join(__dirname, '..', 'distributors.ts'), 'utf8');
        expect(source).not.toMatch(/from\s+'\.\/sips'/);
        expect(source).not.toMatch(/from\s+'node:/);
    });
});
