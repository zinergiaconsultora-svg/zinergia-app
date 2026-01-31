/**
 * Service layer for simulator using secure Server Actions
 */

import { InvoiceData, SavingsResult } from '@/types/crm';
import { createClient } from '@/lib/supabase/client';

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
    results: SavingsResult[]
): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Colors
    const primaryColor = [37, 99, 235] as const; // Blue
    const successColor = [16, 163, 127] as const; // Green

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Comparación de Tarifas', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Informe de Ahorro Energético', 105, 30, { align: 'center' });

    // Invoice Summary
    let yPosition = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('Resumen de Factura', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.text(`Cliente: ${invoiceData.client_name || 'N/A'}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Comercializadora: ${invoiceData.company_name || 'N/A'}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Tarifa: ${invoiceData.tariff_name || 'N/A'}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Consumo Anual Estimado: €${(invoiceData.total_amount || 0).toFixed(2)}`, 20, yPosition);
    yPosition += 15;

    // Results
    doc.setFontSize(16);
    doc.text('Propuestas de Ahorro', 20, yPosition);
    yPosition += 10;

    results.forEach((result, index) => {
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
        }

        // Card background
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(15, yPosition - 5, 180, 50, 3, 3, 'F');

        // Highlight best offer
        if (index === 0) {
            doc.setFillColor(...successColor);
            doc.roundedRect(15, yPosition - 5, 180, 50, 3, 3, 'S');
            doc.setTextColor(255, 255, 255);
        } else {
            doc.setTextColor(0, 0, 0);
        }

        doc.setFontSize(14);
        doc.text(`${index + 1}. ${result.offer.marketer_name}`, 20, yPosition + 5);

        doc.setFontSize(11);
        doc.text(`Tarifa: ${result.offer.tariff_name}`, 20, yPosition + 12);
        doc.text(`Costo Anual: €${result.offer_annual_cost.toFixed(2)}`, 20, yPosition + 19);
        doc.text(`Ahorro: €${result.annual_savings.toFixed(2)} (${result.savings_percent.toFixed(1)}%)`, 20, yPosition + 26);

        yPosition += 55;
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
        `Generado por Zinergia - ${new Date().toLocaleDateString('es-ES')}`,
        105,
        285,
        { align: 'center' }
    );

    // Save
    doc.save(`comparacion-tarifas-${Date.now()}.pdf`);
}

// ============================================================================
// EXPORT TO EXCEL
// ============================================================================

export async function exportResultsToExcel(
    invoiceData: InvoiceData,
    results: SavingsResult[]
): Promise<void> {
    const XLSX = await import('xlsx');

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
        ['Comparación de Tarifas - Zinergia'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
        [''],
        ['Datos de Factura'],
        ['Cliente', invoiceData.client_name || 'N/A'],
        ['Comercializadora', invoiceData.company_name || 'N/A'],
        ['Tarifa Actual', invoiceData.tariff_name || 'N/A'],
        ['Importe Anual', `€${(invoiceData.total_amount || 0).toFixed(2)}`],
        [''],
        ['Resumen de Ahorro'],
        ['Mejor Oferta', results[0]?.offer.marketer_name || 'N/A'],
        ['Ahorro Anual', `€${results.reduce((sum, r) => sum + r.annual_savings, 0).toFixed(2)}`],
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

    // Offers sheet
    const offersData = [
        ['Oferta', 'Comercializadora', 'Tarifa', 'Costo Anual', 'Ahorro', '% Ahorro'],
        ...results.map((r, i) => [
            `Oferta ${i + 1}`,
            r.offer.marketer_name,
            r.offer.tariff_name,
            r.offer_annual_cost.toFixed(2),
            r.annual_savings.toFixed(2),
            r.savings_percent.toFixed(1) + '%',
        ]),
    ];

    const offersWs = XLSX.utils.aoa_to_sheet(offersData);
    XLSX.utils.book_append_sheet(wb, offersWs, 'Ofertas');

    // Detailed pricing sheet
    const pricingData = [
        ['Periodo', 'Precio Potencia (€/kW)', 'Precio Energía (€/kWh)'],
        ['P1', results[0]?.offer.power_price.p1 || 0, results[0]?.offer.energy_price.p1 || 0],
        ['P2', results[0]?.offer.power_price.p2 || 0, results[0]?.offer.energy_price.p2 || 0],
        ['P3', results[0]?.offer.power_price.p3 || 0, results[0]?.offer.energy_price.p3 || 0],
        ['P4', results[0]?.offer.power_price.p4 || 0, results[0]?.offer.energy_price.p4 || 0],
        ['P5', results[0]?.offer.power_price.p5 || 0, results[0]?.offer.energy_price.p5 || 0],
        ['P6', results[0]?.offer.power_price.p6 || 0, results[0]?.offer.energy_price.p6 || 0],
        ['',
            'Cuota Fija', `€${(results[0]?.offer.fixed_fee || 0).toFixed(2)}/mes`,
            'Duración', results[0]?.offer.contract_duration || 'N/A'],
    ];

    const pricingWs = XLSX.utils.aoa_to_sheet(pricingData);
    XLSX.utils.book_append_sheet(wb, pricingWs, 'Precios Detallados');

    // Save
    XLSX.writeFile(wb, `comparacion-tarifas-${Date.now()}.xlsx`);
}
