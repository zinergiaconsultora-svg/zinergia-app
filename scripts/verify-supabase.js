/**
 * Verificación de Supabase - Zinergia
 * Ejecutar: node scripts/verify-supabase.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: No se encontraron las credenciales de Supabase en .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔍 Verificando configuración de Supabase...\n');

async function verifySetup() {
    const results = [];

    // 1. Verificar tabla lv_zinergia_tarifas
    console.log('📋 Verificando tabla lv_zinergia_tarifas...');
    try {
        const { data, error, count } = await supabase
            .from('lv_zinergia_tarifas')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
            results.push({ check: 'lv_zinergia_tarifas', status: 'FAIL', error: error.message });
        } else {
            console.log(`   ✅ PASS - ${count} tarifas encontradas\n`);
            results.push({ check: 'lv_zinergia_tarifas', status: 'PASS', count });
        }
    } catch (_err) {
        console.log(`   ❌ Error: ${_err.message}\n`);
        results.push({ check: 'lv_zinergia_tarifas', status: 'FAIL', error: _err.message });
    }

    // 2. Verificar vista v_active_tariffs
    console.log('📋 Verificando vista v_active_tariffs...');
    try {
        const { data, error, count } = await supabase
            .from('v_active_tariffs')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
            results.push({ check: 'v_active_tariffs', status: 'FAIL', error: error.message });
        } else {
            console.log(`   ✅ PASS - ${count} tarifas activas\n`);
            results.push({ check: 'v_active_tariffs', status: 'PASS', count });
        }
    } catch (_err) {
        console.log(`   ❌ Error: ${_err.message}\n`);
        results.push({ check: 'v_active_tariffs', status: 'FAIL', error: _err.message });
    }

    // 3. Verificar tipos de tarifas
    console.log('📋 Verificando tipos de tarifas...');
    try {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select('tariff_type, offer_type')
            .eq('is_active', true);
        
        if (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
            results.push({ check: 'tariff_types', status: 'FAIL', error: error.message });
        } else {
            const types: Record<string, number> = {};
            data.forEach(t => {
                const key = `${t.tariff_type} - ${t.offer_type}`;
                types[key] = (types[key] || 0) + 1;
            });
            
            console.log('   ✅ PASS - Tipos encontrados:');
            Object.entries(types).forEach(([type, count]) => {
                console.log(`      ${type}: ${count}`);
            });
            console.log('');
            results.push({ check: 'tariff_types', status: 'PASS', types });
        }
    } catch (_err) {
        console.log(`   ❌ Error: ${_err.message}\n`);
        results.push({ check: 'tariff_types', status: 'FAIL', error: _err.message });
    }

    // 4. Verificar empresas de tarifas
    console.log('📋 Verificando empresas de tarifas...');
    try {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select('company')
            .eq('is_active', true);
        
        if (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
            results.push({ check: 'tariff_companies', status: 'FAIL', error: error.message });
        } else {
            const companies = [...new Set(data.map(t => t.company))];
            console.log(`   ✅ PASS - ${companies.length} empresas encontradas:`);
            companies.slice(0, 10).forEach(c => console.log(`      - ${c}`));
            if (companies.length > 10) {
                console.log(`      ... y ${companies.length - 10} más`);
            }
            console.log('');
            results.push({ check: 'tariff_companies', status: 'PASS', count: companies.length });
        }
    } catch (_err) {
        console.log(`   ❌ Error: ${_err.message}\n`);
        results.push({ check: 'tariff_companies', status: 'FAIL', error: _err.message });
    }

    // 5. Verificar muestra de tarifas
    console.log('📋 Muestra de tarifas (primeras 5):');
    try {
        const { data, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select('company, tariff_name, tariff_type, offer_type, power_price_p1, energy_price_p1')
            .eq('is_active', true)
            .limit(5)
            .order('company', { ascending: true });
        
        if (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        } else {
            data.forEach(t => {
                console.log(`   • ${t.company} - ${t.tariff_name} (${t.tariff_type}, ${t.offer_type})`);
                console.log(`     Potencia P1: €${t.power_price_p1}/kW/día | Energía P1: €${t.energy_price_p1}/kWh`);
            });
            console.log('');
        }
    } catch (_err) {
        console.log(`   ❌ Error: ${_err.message}\n`);
    }

    // Resumen
    console.log('📊 RESUMEN:');
    console.log('━'.repeat(50));
    const passed = results.filter(r => r.status === 'PASS').length;
    const total = results.length;
    
    results.forEach(r => {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        const msg = r.status === 'PASS' 
            ? `${r.check}${r.count ? ` (${r.count} registros)` : ''}`
            : `${r.check} - ${r.error}`;
        console.log(`${icon} ${msg}`);
    });
    
    console.log('━'.repeat(50));
    console.log(`\nResultado: ${passed}/${total} checks pasaron\n`);

    if (passed === total) {
        console.log('🎉 ¡Todo configurado correctamente!\n');
        console.log('📱 Para probar en la aplicación:');
        console.log('   npm run dev');
        console.log('   Abre: http://localhost:3000/dashboard/simulator\n');
    } else {
        console.log('⚠️  Hay problemas que necesitan atención.\n');
        console.log('📝 Para ejecutar el setup completo:');
        console.log('   1. Ve a: https://jycwgzdrysesfcxgrxwg.supabase.co');
        console.log('   2. SQL Editor > New query');
        console.log('   3. Copia el contenido de: supabase_setup_consolidated.sql');
        console.log('   4. Ejecuta el script\n');
    }
}

verifySetup().catch(console.error);
