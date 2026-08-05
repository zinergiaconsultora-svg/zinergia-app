
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedHQ() {
    console.log('🌱 Seeding HQ Franchise...');

    // 1. Check if it exists
    const { data: existing, error: findError } = await supabase
        .from('franchises')
        .select('id')
        .eq('slug', 'hq')
        .maybeSingle();

    if (findError) {
        console.error('Error finding HQ:', findError);
        return;
    }

    if (existing) {
        console.log('✅ HQ Franchise already exists:', existing.id);
        return;
    }

    // 2. Create if missing
    const { data: newF, error: createError } = await supabase
        .from('franchises')
        .insert({
            slug: 'hq',
            name: 'Zinergia Central',
            is_active: true
        })
        .select()
        .single();

    if (createError) {
        console.error('❌ Failed to create HQ:', createError);
    } else {
        console.log('✅ HQ Franchise created:', newF.id);
    }
}

seedHQ();
