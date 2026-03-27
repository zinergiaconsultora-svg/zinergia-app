/**
 * Service layer for simulator using secure Server Actions
 */

import { InvoiceData, SavingsResult } from '@/types/crm';
import { createClient } from '@/lib/supabase/client';
import { OptimizationRecommendation } from '@/lib/aletheia/types';

import { analyzeDocumentAction } from '@/app/actions/ocr';
import { calculateSavingsAction } from '@/app/actions/compare';

// ============================================================================
// WEBHOOK CALLS VIA SERVER ACTIONS
// ============================================================================

export async function analyzeDocumentWithRetry(file: File): Promise<InvoiceData> {
    const formData = new FormData();
    formData.append('file', file);
    return await analyzeDocumentAction(formData);
}

export async function calculateSavingsWithRetry(invoice: InvoiceData): Promise<SavingsResult[]> {
    const data = await calculateSavingsAction(invoice);
    const currentCost = data.current_annual_cost || 0;

    return data.offers.map((offer: SavingsResult['offer'] & { annual_cost?: number; optimization_result?: unknown }) => ({
        offer: {
            id: offer.id,
            marketer_name: offer.marketer_name,
            tariff_name: offer.tariff_name,
            logo_color: offer.logo_color || 'bg-blue-600',
            type: offer.type,
            power_price: offer.power_price,
            energy_price: offer.energy_price,
            fixed_fee: offer.fixed_fee,
            contract_duration: offer.contract_duration,
        },
        current_annual_cost: currentCost,
        offer_annual_cost: offer.annual_cost || 0,
        annual_savings: Math.max(0, currentCost - (offer.annual_cost || 0)),
        savings_percent: currentCost > 0 ? ((currentCost - (offer.annual_cost || 0)) / currentCost) * 100 : 0,
        optimization_result: offer.optimization_result,
    }));
}

// ============================================================================
// SIMULATION HISTORY (SUPABASE)
// ============================================================================

export interface SimulationRecord {
    id: string;
    user_id: string;
    invoice_data: InvoiceData;
    results: SavingsResult[];
    is_mock: boolean;
    created_at: string;
    total_savings: number;
    best_offer_id: string;
}

export function validateFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.type !== 'application/pdf') {
        return { valid: false, error: 'Solo se permiten archivos PDF' };
    }
    if (file.size > MAX_SIZE) {
        return { valid: false, error: 'El archivo excede 10MB' };
    }
    return { valid: true };
}

export async function saveSimulation(
    invoiceData: InvoiceData,
    results: SavingsResult[],
    isMock: boolean
): Promise<SimulationRecord> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const bestOffer = results[0];
    const totalSavings = results.reduce((sum, r) => sum + r.annual_savings, 0);

    const { data, error } = await supabase
        .from('simulation_history')
        .insert({
            user_id: user.id,
            invoice_data: invoiceData,
            results: results,
            is_mock: isMock,
            total_savings: totalSavings,
            best_offer_id: bestOffer.offer.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving simulation:', error);
        throw new Error('Failed to save simulation');
    }

    return data as SimulationRecord;
}

export async function getSimulationHistory(limit = 10): Promise<SimulationRecord[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('simulation_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching simulation history:', error);
        return [];
    }

    return (data || []) as SimulationRecord[];
}

export async function deleteSimulation(simulationId: string): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('simulation_history')
        .delete()
        .eq('id', simulationId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error('Failed to delete simulation');
    }
}

// ============================================================================
// EXPORT TO PDF
// ============================================================================

export async function exportResultsToPDF(
    invoiceData: InvoiceData,
    results: SavingsResult[],
    optimizationRecommendations?: OptimizationRecommendation[]
): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Zinergia Brand Colors
    const primaryColor = [16, 163, 127] as const; // Emerald-500
    const secondaryColor = [20, 184, 166] as const; // Teal-500
    const accentColor = [5, 150, 105] as const; // Emerald-600
    const darkColor = [15, 23, 42] as const; // Slate-900
    const successColor = [34, 197, 94] as const; // Green-500
    const warningColor = [251, 146, 60] as const; // Orange-400

    // Header with Zinergia branding
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 50, 'F');

    // Gradient effect
    doc.setFillColor(...secondaryColor);
    doc.rect(0, 30, 210, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Zinergia', 20, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Informe de Comparación de Tarifas Eléctricas', 20, 30);
    doc.setFontSize(10);
    doc.text('Análisis Inteligente de Ahorro Energético', 20, 37);

    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, 190, 20, { align: 'right' });

    let yPosition = 60;

    // Client Information Section
    doc.setFillColor(...primaryColor);
    doc.roundedRect(15, yPosition, 180, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información del Cliente', 20, yPosition + 6);
    yPosition += 12;

    doc.setFillColor(249, 250, 251); // Light gray
    doc.roundedRect(15, yPosition, 180, 30, 2, 2, 'F');

    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Cliente: ${invoiceData.client_name || 'N/A'}`, 20, yPosition + 8);
    doc.text(`Comercializadora Actual: ${invoiceData.company_name || 'N/A'}`, 20, yPosition + 16);
    doc.text(`Tarifa Actual: ${invoiceData.tariff_name || invoiceData.detected_power_type || 'N/A'}`, 20, yPosition + 24);

    yPosition += 38;

    // Current Consumption Summary
    const totalConsumption = (invoiceData.energy_p1 || 0) + (invoiceData.energy_p2 || 0) + (invoiceData.energy_p3 || 0) +
                            (invoiceData.energy_p4 || 0) + (invoiceData.energy_p5 || 0) + (invoiceData.energy_p6 || 0);

    doc.setFillColor(...primaryColor);
    doc.roundedRect(15, yPosition, 180, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Consumo Actual', 20, yPosition + 6);
    yPosition += 12;

    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, yPosition, 180, 25, 2, 2, 'F');

    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Consumo Total: ${totalConsumption.toFixed(0)} kWh`, 20, yPosition + 8);
    doc.text(`Costo Anual Estimado: €${(results[0]?.current_annual_cost || 0).toFixed(2)}`, 20, yPosition + 16);

    yPosition += 33;

    // Optimization Recommendations Section
    if (optimizationRecommendations && optimizationRecommendations.length > 0) {
        doc.setFillColor(...warningColor);
        doc.roundedRect(15, yPosition, 180, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Recomendaciones de Optimización', 20, yPosition + 6);
        yPosition += 12;

        optimizationRecommendations.slice(0, 3).forEach((rec, idx) => {
            if (yPosition > 220) {
                doc.addPage();
                yPosition = 20;
            }

            const priorityColor = rec.priority === 'HIGH' ? successColor : (rec.priority === 'MEDIUM' ? warningColor : [100, 116, 139] as const);

            doc.setFillColor(249, 250, 251);
            doc.roundedRect(15, yPosition, 180, 35, 2, 2, 'F');

            doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
            doc.roundedRect(15, yPosition, 4, 35, 2, 2, 'F');

            doc.setTextColor(...darkColor);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(rec.title, 25, yPosition + 8);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const descriptionLines = doc.splitTextToSize(rec.description, 155);
            doc.text(descriptionLines, 25, yPosition + 16);

            if (rec.annual_savings > 0) {
                doc.setTextColor(...successColor);
                doc.setFont('helvetica', 'bold');
                doc.text(`Ahorro Potencial: €${rec.annual_savings.toFixed(0)}/año`, 25, yPosition + 28);
            }

            yPosition += 40;
        });

        yPosition += 5;
    }

    // Top 3 Proposals Section
    if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
    }

    doc.setFillColor(...accentColor);
    doc.roundedRect(15, yPosition, 180, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 3 Propuestas de Ahorro', 20, yPosition + 6);
    yPosition += 12;

    results.slice(0, 3).forEach((result, index) => {
        if (yPosition > 230) {
            doc.addPage();
            yPosition = 20;
        }

        // Card style
        if (index === 0) {
            doc.setFillColor(...successColor);
            doc.roundedRect(15, yPosition - 2, 180, 55, 3, 3, 'F');
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(15, yPosition - 2, 180, 55, 3, 3, 'S');
            doc.setFillColor(240, 253, 244);
            doc.roundedRect(16, yPosition - 1, 178, 53, 2, 2, 'F');
        } else {
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(15, yPosition - 2, 180, 55, 3, 3, 'F');
        }

        doc.setTextColor(...darkColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);

        const rankLabel = index === 0 ? '⭐ MEJOR OPCIÓN' : `Opción #${index + 1}`;
        doc.text(rankLabel, 20, yPosition + 8);

        doc.setFontSize(12);
        doc.text(result.offer.marketer_name, 20, yPosition + 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Tarifa: ${result.offer.tariff_name}`, 20, yPosition + 26);
        doc.text(`Tipo: ${result.offer.type === 'fixed' ? 'Precio Fijo' : 'Indexado'}`, 20, yPosition + 33);

        // Price and Savings on the right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`€${result.offer_annual_cost.toFixed(2)}/año`, 140, yPosition + 8);

        doc.setTextColor(...successColor);
        doc.text(`€${result.annual_savings.toFixed(2)}`, 140, yPosition + 18);
        doc.setFontSize(10);
        doc.text(`${result.savings_percent.toFixed(1)}% descuento`, 140, yPosition + 25);

        yPosition += 60;
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(...primaryColor);
        doc.rect(0, 285, 210, 7, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Generado por Zinergia - ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            105,
            289,
            { align: 'center' }
        );
        doc.text(`Página ${i} de ${pageCount}`, 190, 289, { align: 'right' });
    }

    // Save
    const fileName = `zinergia-comparacion-${invoiceData.client_name?.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    doc.save(fileName);
}

// ============================================================================
// EXPORT TO EXCEL
// ============================================================================

export async function exportResultsToExcel(
    invoiceData: InvoiceData,
    results: SavingsResult[]
): Promise<void> {
    const XLSX = await import('xlsx');

    // ── Sheet 1: Resumen del cliente ────────────────────────────────────────
    const totalKwh =
        (invoiceData.energy_p1 || 0) + (invoiceData.energy_p2 || 0) +
        (invoiceData.energy_p3 || 0) + (invoiceData.energy_p4 || 0) +
        (invoiceData.energy_p5 || 0) + (invoiceData.energy_p6 || 0);

    const summaryData = [
        ['INFORME DE COMPARACIÓN DE TARIFAS — ZINERGIA', ''],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
        ['Cliente', invoiceData.client_name || 'N/A'],
        ['Comercializadora actual', invoiceData.company_name || 'N/A'],
        ['Tarifa actual', invoiceData.tariff_name || invoiceData.detected_power_type || 'N/A'],
        ['Consumo total factura (kWh)', totalKwh],
        ['Días facturados', invoiceData.period_days],
        ['Coste anual actual (€)', results[0]?.current_annual_cost?.toFixed(2) || 'N/A'],
    ];

    // ── Sheet 2: Comparativa de ofertas ────────────────────────────────────
    const offersHeader = [
        'Pos.', 'Comercializadora', 'Tarifa', 'Tipo',
        'Coste anual (€)', 'Ahorro anual (€)', 'Ahorro (%)',
        'P1 Potencia', 'P2 Potencia', 'P3 Potencia',
        'P1 Energía', 'P2 Energía', 'P3 Energía',
        'Permanencia',
    ];

    const offersRows = results.map((r, i) => [
        i + 1,
        r.offer.marketer_name,
        r.offer.tariff_name,
        r.offer.type === 'fixed' ? 'Precio Fijo' : 'Indexado',
        r.offer_annual_cost.toFixed(2),
        r.annual_savings.toFixed(2),
        r.savings_percent.toFixed(1) + '%',
        r.offer.power_price?.p1 || 0,
        r.offer.power_price?.p2 || 0,
        r.offer.power_price?.p3 || 0,
        r.offer.energy_price?.p1 || 0,
        r.offer.energy_price?.p2 || 0,
        r.offer.energy_price?.p3 || 0,
        r.offer.contract_duration || 'Sin permanencia',
    ]);

    // ── Sheet 3: Consumo por periodos ───────────────────────────────────────
    const consumptionData = [
        ['Periodo', 'Potencia contratada (kW)', 'Energía consumida (kWh)'],
        ['P1', invoiceData.power_p1 || 0, invoiceData.energy_p1 || 0],
        ['P2', invoiceData.power_p2 || 0, invoiceData.energy_p2 || 0],
        ['P3', invoiceData.power_p3 || 0, invoiceData.energy_p3 || 0],
        ['P4', invoiceData.power_p4 || 0, invoiceData.energy_p4 || 0],
        ['P5', invoiceData.power_p5 || 0, invoiceData.energy_p5 || 0],
        ['P6', invoiceData.power_p6 || 0, invoiceData.energy_p6 || 0],
    ];

    // ── Assemble workbook ───────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    const wsOffers = XLSX.utils.aoa_to_sheet([offersHeader, ...offersRows]);
    XLSX.utils.book_append_sheet(wb, wsOffers, 'Comparativa');

    const wsConsumption = XLSX.utils.aoa_to_sheet(consumptionData);
    XLSX.utils.book_append_sheet(wb, wsConsumption, 'Consumo');

    const fileName = `zinergia-comparacion-${invoiceData.client_name?.replace(/\s+/g, '-') || 'cliente'}-${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
