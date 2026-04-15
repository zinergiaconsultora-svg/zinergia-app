import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { sendPushToUser } from '@/lib/push/sendPush';

function normalizeCompanyName(raw: string): string {
    return raw
        .toUpperCase()
        .replace(/\bS\.?A\.?\b|\bS\.?L\.?\b|\bS\.?A\.?U\.?\b/g, '')
        .replace(/ENERGIA|ENERGÍA|ENERGY/g, '')
        .replace(/[^A-ZÁÉÍÓÚÑ0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^NATURGY.*/, 'NATURGY')
        .replace(/^ENDESA.*/, 'ENDESA')
        .replace(/^IBERDROLA.*/, 'IBERDROLA')
        .replace(/^REPSOL.*/, 'REPSOL')
        .replace(/^EDP.*/, 'EDP')
        .replace(/^HOLALUZ.*/, 'HOLALUZ')
        .replace(/^OCTOPUS.*/, 'OCTOPUS')
        .replace(/^PODO.*/, 'PODO');
}

export async function POST(request: Request) {
    // 1. Autenticar request de N8N
    const apiKey = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');
    console.log('[OCR Callback] Received. x-api-key present:', !!apiKey, '| authorization present:', !!authHeader, '| key match:', apiKey === env.WEBHOOK_API_KEY);

    if (apiKey !== env.WEBHOOK_API_KEY) {
        console.warn('[OCR Callback] Auth failed. Received x-api-key:', apiKey?.slice(0, 8) ?? 'null');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const { job_id, status, data, error, confidence } = payload;

        if (!job_id) {
            return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
        }

        const VALID_STATUSES = ['completed', 'failed'] as const;
        if (!status || !VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }
        const supabaseAdmin = createClient(
            env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey
        );

        // 2. Normalizar datos extraídos
        let invoiceData: Record<string, unknown> | null = null;
        if (status === 'completed' && data) {
            const rawData = Array.isArray(data) ? data[0]?.output || data[0] : data?.output || data;

            const parseNumber = (value: unknown) => {
                if (value === undefined || value === null || value === '') return 0;
                const strValue = String(value).trim().replace(/\s/g, '');
                if (strValue.includes('.') && strValue.includes(',')) {
                    return parseFloat(strValue.replace(/\./g, '').replace(',', '.'));
                }
                if (strValue.includes(',')) return parseFloat(strValue.replace(',', '.'));
                return parseFloat(strValue) || 0;
            };

            const rawTariff = (rawData.tariff_name || rawData.TARIFA || rawData.tarifa || rawData.ACCESO || '').toUpperCase();

            let detectedPowerType = '2.0';
            if (rawTariff.includes('3.1') || rawTariff.includes('6.1') || rawTariff.includes('6.2')) {
                detectedPowerType = '3.1';
            } else if (rawTariff.includes('3.0') || rawTariff.includes('3.0TD')) {
                detectedPowerType = '3.0';
            }

            // Confidence scores por campo (si N8N los envía, si no se asume 1.0)
            const confidenceScores: Record<string, number> = {};
            if (confidence && typeof confidence === 'object') {
                for (const [field, score] of Object.entries(confidence)) {
                    confidenceScores[field] = typeof score === 'number' ? score : 1.0;
                }
            }

            // N8N puede enviar CIF y DNI por separado — combinar en dni_cif priorizando CIF para empresas
            const rawCif = (rawData.CIF || rawData.cif || rawData.CIF_NIF || rawData.nif_cif || '') as string;
            const rawDni = (rawData.DNI || rawData.dni || rawData.NIF || rawData.nif || '') as string;
            const resolvedDniCif = (rawData.dni_cif as string) || rawCif || rawDni || '';

            invoiceData = {
                client_name: rawData.client_name || rawData.CLIENTE_NOMBRE || rawData.cliente_nombre || rawData.TITULAR || 'Cliente Desconocido',
                dni_cif: resolvedDniCif,
                company_name: rawData.company_name || rawData.COMPANIA || rawData.COMERCIALIZADORA || rawData.compania || rawData.EMPRESA || '',
                cups: rawData.cups || rawData.CUPS || rawData.cups_suministro || '',
                tariff_name: rawTariff || '2.0TD',
                invoice_number: rawData.invoice_number || rawData.NUMERO_FACTURA || rawData.numero_factura || '',
                invoice_date: rawData.invoice_date || rawData.FECHA_FACTURA || rawData.fecha_factura || '',
                period_days: parseNumber(rawData.period_days || rawData.periodo_facturacion || rawData.DIAS_FACTURACION || 30),
                supply_address: rawData.supply_address || rawData.DIRECCION_SUMINISTRO || rawData.direccion_suministro || rawData.DIRECCION || '',
                subtotal: parseNumber(rawData.subtotal || rawData.SUBTOTAL),
                vat: parseNumber(rawData.iva || rawData.IVA),
                total_amount: parseNumber(rawData.importe_total || rawData.IMPORTE_TOTAL || rawData.total || rawData.TOTAL || rawData.TOTAL_FACTURA || rawData.importe || rawData.IMPORTE),
                rights_cost: parseNumber(rawData.derechos_enganche || rawData.DERECHOS),
                power_p1: parseNumber(rawData.power_p1 || rawData.POTENCIA_P1 || rawData.potencia_p1),
                power_p2: parseNumber(rawData.power_p2 || rawData.POTENCIA_P2 || rawData.potencia_p2),
                power_p3: parseNumber(rawData.power_p3 || rawData.POTENCIA_P3 || rawData.potencia_p3),
                power_p4: parseNumber(rawData.power_p4 || rawData.POTENCIA_P4 || rawData.potencia_p4),
                power_p5: parseNumber(rawData.power_p5 || rawData.POTENCIA_P5 || rawData.potencia_p5),
                power_p6: parseNumber(rawData.power_p6 || rawData.POTENCIA_P6 || rawData.potencia_p6),
                energy_p1: parseNumber(rawData.energy_p1 || rawData.ENERGIA_P1 || rawData.energia_p1),
                energy_p2: parseNumber(rawData.energy_p2 || rawData.ENERGIA_P2 || rawData.energia_p2),
                energy_p3: parseNumber(rawData.energy_p3 || rawData.ENERGIA_P3 || rawData.energia_p3),
                energy_p4: parseNumber(rawData.energy_p4 || rawData.ENERGIA_P4 || rawData.energia_p4),
                energy_p5: parseNumber(rawData.energy_p5 || rawData.ENERGIA_P5 || rawData.energia_p5),
                energy_p6: parseNumber(rawData.energy_p6 || rawData.ENERGIA_P6 || rawData.energia_p6),
                detected_power_type: detectedPowerType,

                // Precios actuales de energía (si N8N los extrae de la factura)
                current_energy_price_p1: parseNumber(rawData.current_energy_price_p1 || rawData.precio_energia_p1 || rawData.PRECIO_ENERGIA_P1 || 0) || undefined,
                current_energy_price_p2: parseNumber(rawData.current_energy_price_p2 || rawData.precio_energia_p2 || rawData.PRECIO_ENERGIA_P2 || 0) || undefined,
                current_energy_price_p3: parseNumber(rawData.current_energy_price_p3 || rawData.precio_energia_p3 || rawData.PRECIO_ENERGIA_P3 || 0) || undefined,

                // Datos forenses — penalización reactiva, tipo acceso tarifa, etc.
                forensic_details: (() => {
                    const rd = rawData as Record<string, unknown>;
                    const reactive = rd.energia_reactiva || rd.ENERGIA_REACTIVA || rd.energy_reactive;
                    const reactiveKvarh = reactive ? parseNumber(reactive) : 0;
                    const hasReactivePenalty = !!(rd.penalizacion_reactiva || rd.reactive_penalty || reactiveKvarh > 0);
                    const tariffAccess = (rd.acceso_tarifa || rd.tariff_access || rawTariff || '') as string;
                    if (!hasReactivePenalty && reactiveKvarh === 0 && !tariffAccess) return undefined;
                    return {
                        energy_reactive: reactiveKvarh > 0 ? reactiveKvarh : undefined,
                        reactive_penalty: hasReactivePenalty,
                        tariff_access: tariffAccess || undefined,
                    };
                })(),

                // Confidence scores embebidos — usados en la UI para resaltar campos dudosos
                // NOTA: extractInvoiceData() en useSimulator los elimina antes de pasar al motor de cálculo
                _confidence: Object.keys(confidenceScores).length > 0 ? confidenceScores : null,
            };
        }

        // 3. Recuperar job para obtener agent_id y franchise_id (+ status para idempotencia)
        const { data: job } = await supabaseAdmin
            .from('ocr_jobs')
            .select('id, agent_id, franchise_id, file_name, status')
            .eq('id', job_id)
            .single();

        // 3b. Idempotencia: si N8N reintenta tras un éxito, ignoramos el segundo callback
        // para no sobrescribir datos buenos ni reactivar side effects (cliente, training, push).
        // Permitimos `failed -> completed` (recuperación tras reintento exitoso) pero
        // bloqueamos cualquier transición desde `completed`.
        if (job?.status === 'completed') {
            console.warn('[OCR Callback] Ignored duplicate callback for already-completed job:', job_id);
            return NextResponse.json({ success: true, idempotent: true, client_id: null });
        }

        // 4. Auto-crear/actualizar cliente desde los datos extraídos
        let clientId: string | null = null;
        if (status === 'completed' && invoiceData && job?.agent_id && job?.franchise_id) {
            try {
                const clientName = invoiceData.client_name as string;
                const cups = invoiceData.cups as string;
                const dniCif = invoiceData.dni_cif as string;

                // Buscar cliente existente por CUPS (más único) o por DNI/CIF
                let existingClient = null;
                if (cups) {
                    const { data } = await supabaseAdmin
                        .from('clients')
                        .select('id')
                        .eq('franchise_id', job.franchise_id)
                        .eq('cups', cups)
                        .maybeSingle();
                    existingClient = data;
                }
                if (!existingClient && dniCif) {
                    const { data } = await supabaseAdmin
                        .from('clients')
                        .select('id')
                        .eq('franchise_id', job.franchise_id)
                        .eq('dni_cif', dniCif)
                        .maybeSingle();
                    existingClient = data;
                }

                if (existingClient) {
                    // Actualizar datos del cliente existente
                    await supabaseAdmin
                        .from('clients')
                        .update({
                            cups: cups || undefined,
                            current_supplier: (invoiceData.company_name as string) || undefined,
                            tariff_type: (invoiceData.tariff_name as string) || undefined,
                            address: (invoiceData.supply_address as string) || undefined,
                            contracted_power: {
                                p1: invoiceData.power_p1, p2: invoiceData.power_p2,
                                p3: invoiceData.power_p3, p4: invoiceData.power_p4,
                                p5: invoiceData.power_p5, p6: invoiceData.power_p6,
                            },
                            average_monthly_bill: invoiceData.total_amount
                                ? Math.round((invoiceData.total_amount as number) / ((invoiceData.period_days as number || 30) / 30))
                                : undefined,
                        })
                        .eq('id', existingClient.id);
                    clientId = existingClient.id;
                } else if (clientName && clientName !== 'Cliente Desconocido') {
                    // Crear nuevo cliente
                    const { data: newClient } = await supabaseAdmin
                        .from('clients')
                        .insert({
                            franchise_id: job.franchise_id,
                            owner_id: job.agent_id,
                            name: clientName,
                            dni_cif: dniCif || null,
                            cups: cups || null,
                            address: (invoiceData.supply_address as string) || null,
                            current_supplier: (invoiceData.company_name as string) || null,
                            tariff_type: (invoiceData.tariff_name as string) || null,
                            contracted_power: {
                                p1: invoiceData.power_p1, p2: invoiceData.power_p2,
                                p3: invoiceData.power_p3, p4: invoiceData.power_p4,
                                p5: invoiceData.power_p5, p6: invoiceData.power_p6,
                            },
                            average_monthly_bill: invoiceData.total_amount
                                ? Math.round((invoiceData.total_amount as number) / ((invoiceData.period_days as number || 30) / 30))
                                : null,
                            type: dniCif ? 'company' : 'residential',
                            status: 'new',
                        })
                        .select('id')
                        .single();
                    clientId = newClient?.id ?? null;
                }
            } catch (clientErr) {
                // No bloquear el flujo si falla la creación del cliente
                console.warn('[OCR Callback] Auto-client creation failed (non-blocking):', clientErr);
            }
        }

        // 5. Actualizar job en la DB (campo correcto: extracted_data)
        const updatePayload: Record<string, unknown> = { status };
        if (invoiceData) updatePayload.extracted_data = invoiceData;
        if (error) updatePayload.error_message = error;
        if (clientId) updatePayload.client_id = clientId;

        const { error: dbError } = await supabaseAdmin
            .from('ocr_jobs')
            .update(updatePayload)
            .eq('id', job_id);

        if (dbError) {
            console.error('[OCR Callback] DB Update Error:', dbError);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        // 5b. Guardar ejemplo de entrenamiento para few-shot memory (Fase 1)
        // Solo para extracciones completadas con nombre de empresa identificable
        if (status === 'completed' && invoiceData) {
            const rawCompanyName = invoiceData.company_name as string | undefined;
            if (rawCompanyName && rawCompanyName !== '') {
                try {
                    const companyNormalized = normalizeCompanyName(rawCompanyName);

                    // Hash ligero para evitar duplicar la misma factura
                    const fileHash = [
                        job?.agent_id ?? 'anon',
                        job?.file_name ?? 'unknown',
                        new Date().toISOString().slice(0, 10), // día
                    ].join('|');

                    // Calcular confianza media si N8N la envió
                    let confidenceAvg: number | null = null;
                    const confData = invoiceData._confidence as Record<string, number> | null;
                    if (confData && typeof confData === 'object') {
                        const scores = Object.values(confData).filter(v => typeof v === 'number');
                        if (scores.length > 0) {
                            confidenceAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
                        }
                    }

                    // raw_text_sample: N8N puede enviarlo en el payload como `text_sample`
                    const rawTextSample = (payload.text_sample as string | undefined)?.slice(0, 1500) ?? null;

                    await supabaseAdmin
                        .from('ocr_training_examples')
                        .upsert({
                            company_name: companyNormalized,
                            file_hash: fileHash,
                            raw_text_sample: rawTextSample,
                            raw_fields: data ?? null,          // campos brutos de N8N antes de normalizar
                            extracted_fields: invoiceData,
                            is_validated: false,
                            confidence_avg: confidenceAvg,
                            n8n_model: (payload.model as string | undefined) ?? null,
                            ocr_job_id: job_id,
                            franchise_id: job?.franchise_id ?? null,
                        }, { onConflict: 'file_hash', ignoreDuplicates: true });
                } catch (trainingErr) {
                    // No bloquear el flujo si falla el guardado del ejemplo
                    console.warn('[OCR Callback] Training example save failed (non-blocking):', trainingErr);
                }
            }
        }

        // 6. Broadcast Realtime directo al cliente — sin RLS, entrega inmediata
        try {
            await new Promise<void>((resolve) => {
                const broadcastChannel = supabaseAdmin.channel(`ocr_job_${job_id}`);
                broadcastChannel.subscribe((state) => {
                    if (state === 'SUBSCRIBED') {
                        broadcastChannel.send({
                            type: 'broadcast',
                            event: 'ocr_result',
                            payload: { status, data: invoiceData, error_message: error ?? null },
                        }).then(() => {
                            supabaseAdmin.removeChannel(broadcastChannel);
                            resolve();
                        }).catch(() => resolve());
                    }
                });
                // Timeout safety net
                setTimeout(() => resolve(), 3000);
            });
        } catch (bcErr) {
            console.warn('[OCR Callback] Broadcast failed (non-blocking):', bcErr);
        }

        // 7. Web Push al agente — no bloquea la respuesta
        if (job?.agent_id) {
            const clientName = invoiceData?.client_name as string | undefined;
            const pushPayload = status === 'completed'
                ? {
                    title: 'Factura procesada',
                    body: clientName && clientName !== 'Cliente Desconocido'
                        ? `${clientName} lista para comparar`
                        : `${job.file_name || 'Factura'} procesada correctamente`,
                    url: '/dashboard',
                    icon: '/icon-192.png',
                }
                : {
                    title: 'Error al procesar factura',
                    body: `${job.file_name || 'Factura'}: ${error || 'Error desconocido'}`,
                    url: '/dashboard',
                    icon: '/icon-192.png',
                };

            // Fire-and-forget — no await para no bloquear la respuesta a N8N
            sendPushToUser(job.agent_id, pushPayload).catch(() => {});
        }

        return NextResponse.json({ success: true, client_id: clientId });

    } catch (error) {
        console.error('[OCR Callback] Parsing Error:', error);
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
}
