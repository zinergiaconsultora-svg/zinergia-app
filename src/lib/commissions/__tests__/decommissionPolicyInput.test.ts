import { describe, expect, it } from 'vitest';

import {
    describePolicy,
    parseDecommissionCsv,
    percentageToBps,
} from '../decommissionPolicyInput';

const HEADER = 'comercializadora,producto,dias_consolidacion,dias_clawback,tramo_desde_dia,tramo_hasta_dia,porcentaje_devolucion';

function csv(...rows: string[]): string {
    return [HEADER, ...rows].join('\n');
}

describe('percentageToBps', () => {
    it('convierte porcentajes enteros', () => {
        expect(percentageToBps(100)).toBe(10000);
        expect(percentageToBps(0)).toBe(0);
        expect(percentageToBps(50)).toBe(5000);
    });

    // 12,5 % es 1250 bps exactos. Truncar daría 1249 y la política quedaría mal por
    // un punto básico, que es justo el tipo de error que nadie revisa.
    it('conserva los decimales al redondear', () => {
        expect(percentageToBps(12.5)).toBe(1250);
        expect(percentageToBps(33.33)).toBe(3333);
    });
});

describe('parseDecommissionCsv', () => {
    it('lee una política con tres tramos', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,90,365,0,89,100',
            'LOGOS,,90,365,90,179,50',
            'LOGOS,,90,365,180,365,0',
        ));

        expect(result.errors).toEqual([]);
        expect(result.policies).toHaveLength(1);

        const policy = result.policies[0];
        expect(policy.marketerName).toBe('LOGOS');
        expect(policy.productCode).toBeNull();
        expect(policy.consolidationDays).toBe(90);
        expect(policy.clawbackDays).toBe(365);
        expect(policy.bands).toEqual([
            { activeDayFrom: 0, activeDayTo: 89, reversalBps: 10000 },
            { activeDayFrom: 90, activeDayTo: 179, reversalBps: 5000 },
            { activeDayFrom: 180, activeDayTo: 365, reversalBps: 0 },
        ]);
    });

    it('separa políticas por comercializadora y producto', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,0,365,100',
            'LOGOS,INDEXADO,0,180,0,180,100',
            'NATURGY,,0,365,0,365,100',
        ));

        expect(result.errors).toEqual([]);
        expect(result.policies).toHaveLength(3);
        expect(result.policies.map(p => p.productCode)).toEqual([null, 'INDEXADO', null]);
    });

    it('acepta punto y coma, comillas y porcentajes con coma decimal', () => {
        const result = parseDecommissionCsv([
            HEADER.replace(/,/g, ';'),
            '"GANA ENERGIA";"TARIFA PLANA";30;365;0;364;"12,5"',
            '"GANA ENERGIA";"TARIFA PLANA";30;365;365;365;0',
        ].join('\n'));

        expect(result.errors).toEqual([]);
        expect(result.policies[0].marketerName).toBe('GANA ENERGIA');
        expect(result.policies[0].bands[0].reversalBps).toBe(1250);
    });

    it('ordena los tramos aunque vengan desordenados en la hoja', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,180,365,0',
            'LOGOS,,0,365,0,179,100',
        ));

        expect(result.errors).toEqual([]);
        expect(result.policies[0].bands.map(b => b.activeDayFrom)).toEqual([0, 180]);
    });

    it('ignora comentarios y líneas en blanco', () => {
        const result = parseDecommissionCsv([
            '# Condiciones tomadas del contrato de 2026',
            HEADER,
            '',
            'LOGOS,,0,365,0,365,100',
        ].join('\n'));

        expect(result.errors).toEqual([]);
        expect(result.policies).toHaveLength(1);
    });
});

describe('parseDecommissionCsv — errores que señalan la fila', () => {
    it('detecta un hueco entre tramos', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,0,89,100',
            'LOGOS,,0,365,120,365,0',
        ));

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('línea 3');
        expect(result.errors[0]).toContain('debería empezar en el 90');
    });

    it('detecta tramos solapados', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,0,100,100',
            'LOGOS,,0,365,50,365,0',
        ));

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('no pueden dejar huecos ni solaparse');
    });

    it('detecta que los tramos no llegan al final de la ventana', () => {
        const result = parseDecommissionCsv(csv('LOGOS,,0,365,0,200,100'));

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('Falta un tramo final');
    });

    // Un porcentaje que sube con el tiempo casi siempre es una fila mal copiada, y
    // la base de datos lo rechazaría igualmente.
    it('detecta un porcentaje que crece con el tiempo', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,0,179,50',
            'LOGOS,,0,365,180,365,100',
        ));

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('no puede subir con el tiempo');
    });

    it('detecta ventanas contradictorias dentro de la misma política', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,0,179,100',
            'LOGOS,,0,180,180,365,0',
        ));

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('no coinciden en días');
    });

    it('rechaza una ventana de reclamación menor que la de consolidación', () => {
        const result = parseDecommissionCsv(csv('LOGOS,,200,100,0,100,100'));

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('Línea 2');
    });

    it('avisa de columnas que faltan en vez de leer basura', () => {
        const result = parseDecommissionCsv('comercializadora,producto\nLOGOS,');

        expect(result.policies).toHaveLength(0);
        expect(result.errors[0]).toContain('Faltan columnas obligatorias');
    });

    it('avisa de un fichero vacío', () => {
        expect(parseDecommissionCsv('   ').errors[0]).toContain('vacío');
    });

    // Una política mal transcrita no debe impedir cargar las que sí están bien; el
    // cargador decide qué hacer con la mezcla.
    it('devuelve las políticas correctas junto a los errores de las demás', () => {
        const result = parseDecommissionCsv(csv(
            'LOGOS,,0,365,0,365,100',
            'NATURGY,,0,365,0,200,100',
        ));

        expect(result.policies).toHaveLength(1);
        expect(result.policies[0].marketerName).toBe('LOGOS');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('NATURGY');
    });
});

describe('describePolicy', () => {
    it('resume la política en algo legible antes de enviarla', () => {
        const [policy] = parseDecommissionCsv(csv(
            'LOGOS,,90,365,0,89,100',
            'LOGOS,,90,365,90,365,25',
        )).policies;

        const text = describePolicy(policy);
        expect(text).toContain('LOGOS (todos los productos)');
        expect(text).toContain('consolida a los 90 días');
        expect(text).toContain('días 0-89: devuelve 100%');
        expect(text).toContain('días 90-365: devuelve 25%');
    });
});
