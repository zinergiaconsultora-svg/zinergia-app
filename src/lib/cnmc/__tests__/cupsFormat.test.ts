import { describe, expect, it } from 'vitest';

import { isValidCups, normalizeCups } from '../sips';

/**
 * El alta de un punto de suministro solo comprobaba que el CUPS tuviera entre 5 y
 * 60 caracteres. En producción entraron por ahí valores que no son un CUPS, se
 * cifraron y se indexaron, y quedaron inservibles: no resuelven distribuidora, no
 * permiten consultar el SIPS y no casan con la factura del cliente.
 *
 * Estos casos fijan qué acepta y qué rechaza el validador que ahora guarda esa
 * puerta.
 */
describe('isValidCups como guarda del alta de suministros', () => {
    it('acepta un CUPS de 20 caracteres', () => {
        expect(isValidCups('ES0021000000000000AB')).toBe(true);
    });

    it('acepta un CUPS de 22 caracteres', () => {
        expect(isValidCups('ES0031102868105034EP0F')).toBe(true);
    });

    it('acepta minúsculas y espacios, que se normalizan antes de guardar', () => {
        expect(isValidCups('  es0021000000000000ab ')).toBe(true);
        expect(normalizeCups('  es0021000000000000ab ')).toBe('ES0021000000000000AB');
    });

    // El caso que motivó el cambio: un valor enmascarado tiene 8 caracteres, pasaba
    // el mínimo de 5 y quedaba guardado como si fuera un CUPS real.
    it('rechaza un CUPS enmascarado', () => {
        expect(isValidCups('****97RY')).toBe(false);
    });

    it('rechaza texto suelto y campos de relleno', () => {
        expect(isValidCups('pendiente')).toBe(false);
        expect(isValidCups('no lo tengo')).toBe(false);
        expect(isValidCups('12345')).toBe(false);
    });

    it('rechaza un CUPS incompleto o demasiado largo', () => {
        expect(isValidCups('ES002100000000')).toBe(false);
        expect(isValidCups(`ES${'0'.repeat(30)}`)).toBe(false);
    });

    it('rechaza un país que no es España', () => {
        expect(isValidCups('PT0021000000000000AB')).toBe(false);
    });

    it('rechaza el vacío', () => {
        expect(isValidCups('')).toBe(false);
        expect(isValidCups('   ')).toBe(false);
    });
});
