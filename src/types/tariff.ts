/**
 * Tariff Interface - Represents an energy tariff from a commercial provider
 */
export interface Tariff {
    id: string;
    company: string;           // COMPAÑIA
    name: string;              // TARIFA

    // Power prices (€/kW/día)
    powerPriceP1: number;
    powerPriceP2: number;
    powerPriceP3: number;

    // Energy prices (€/kWh)
    energyPriceP1: number;
    energyPriceP2: number;
    energyPriceP3: number;

    // Fixed costs
    connectionFee: number;     // DERECHOS_ENGANCHE

    // Metadata
    updatedAt: string;
    isActive: boolean;
}

/**
 * Tariff input for creating/editing (without id)
 */
export type TariffInput = Omit<Tariff, 'id' | 'updatedAt'>;

/**
 * CSV row structure from import
 */
export interface TariffCsvRow {
    COMPAÑIA: string;
    TARIFA: string;
    PRECIO_POTENCIA_P1: string;
    PRECIO_POTENCIA_P2: string;
    PRECIO_POTENCIA_P3: string;
    PRECIO_ENERGIA_P1: string;
    PRECIO_ENERGIA_P2: string;
    PRECIO_ENERGIA_P3: string;
    DERECHOS_ENGANCHE: string;
    ACTUALIZACION_DATOS?: string;
}
