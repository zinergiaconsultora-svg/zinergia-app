/**
 * Centralized utility functions for formatting and data manipulation.
 */

/**
 * Formats a number as Euro currency.
 */
export const formatCurrency = (amount: number, minimumFractionDigits = 0) => {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
    }).format(amount);
};

/**
 * Formats a number as a percentage.
 */
export const formatPercent = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('es-ES', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value / 100);
};

/**
 * Formats a date to a standard readable format.
 */
export const formatDate = (date: string | Date, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
    return new Date(date).toLocaleDateString('es-ES', options);
};

/**
 * Calculates current vs new cost difference.
 */
export const calculateDelta = (current: number, proposed: number) => {
    const savings = current - proposed;
    const percent = current > 0 ? (savings / current) * 100 : 0;
    return { savings, percent };
};
