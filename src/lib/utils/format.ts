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
 * Formats a date to a standard readable format.
 */
export const formatDate = (date: string | Date, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
    return new Date(date).toLocaleDateString('es-ES', options);
};
