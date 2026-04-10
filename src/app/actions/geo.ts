'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

interface NominatimResult {
    lat: string;
    lon: string;
}

async function geocodeAddress(city: string, zipCode?: string | null): Promise<{ lat: number; lon: number } | null> {
    const query = [zipCode, city, 'España'].filter(Boolean).join(', ');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Zinergia-CRM/1.0' },
            next: { revalidate: 0 },
        });
        if (!res.ok) return null;
        const data: NominatimResult[] = await res.json();
        if (!data.length) return null;
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch {
        return null;
    }
}

export interface GeocodeResult {
    total: number;
    updated: number;
    failed: number;
}

export async function geocodeClientsAction(): Promise<GeocodeResult> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();

    // Only clients in the user's franchise that lack coordinates but have city or zip_code
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id, role')
        .eq('id', user.id)
        .single();

    let query = supabase
        .from('clients')
        .select('id, city, zip_code')
        .is('latitude', null)
        .or('city.neq.,zip_code.neq.');

    if (profile?.role === 'agent') {
        query = query.eq('owner_id', user.id) as typeof query;
    } else if (profile?.franchise_id) {
        query = query.eq('franchise_id', profile.franchise_id) as typeof query;
    }

    const { data: clients, error } = await query;
    if (error) throw error;

    const pending = (clients ?? []).filter(c => c.city || c.zip_code);
    let updated = 0;
    let failed = 0;

    for (const client of pending) {
        // Nominatim rate limit: 1 request/second
        await new Promise(r => setTimeout(r, 1100));

        const coords = await geocodeAddress(client.city ?? '', client.zip_code);
        if (coords) {
            const { error: updateError } = await supabase
                .from('clients')
                .update({ latitude: coords.lat, longitude: coords.lon })
                .eq('id', client.id);
            if (!updateError) updated++;
            else failed++;
        } else {
            failed++;
        }
    }

    return { total: pending.length, updated, failed };
}
