/**
 * Quick Check - Supabase Setup
 * Ejecutar: npm run supabase:setup:check
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('❌ Supabase: No configurado');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function quickCheck() {
    try {
        const { count, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log('❌ Supabase: Tabla lv_zinergia_tarifas no encontrada');
            console.log('   Ejecuta: npm run supabase:verify');
            process.exit(1);
        }
        
        if (count >= 34) {
            console.log('✅ Supabase: Configurado correctamente');
            console.log(`   ${count} tarifas cargadas`);
            console.log('   Listo para usar el simulador');
        } else if (count > 0) {
            console.log(`⚠️  Supabase: Solo ${count}/34 tarifas encontradas`);
        } else {
            console.log('❌ Supabase: No hay tarifas cargadas');
        }
    } catch (err) {
        console.log('❌ Supabase: Error de conexión');
        console.log('   Verifica tus credenciales en .env.local');
    }
}

quickCheck();
