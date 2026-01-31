'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { crmService } from '@/services/crmService';
import { MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Dynamic import for Leaflet components (they expect 'window' to be defined)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

interface GeoClient {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    city?: string;
}

export const MapView: React.FC = () => {
    const [clients, setClients] = useState<GeoClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [L, setL] = useState<typeof import('leaflet') | null>(null);

    useEffect(() => {
        // Load Leaflet object for specific icons
        if (typeof window !== 'undefined') {
            import('leaflet').then(leaflet => {
                setL(leaflet);
            });
        }

        async function loadClients() {
            try {
                const data = await crmService.getGeolocatedClients();
                setClients(data as GeoClient[]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadClients();
    }, []);

    if (loading || !L) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Fix for Leaflet default icon issues in Webpack/Next.js
    const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Navigation size={20} className="text-indigo-600" />
                        Geo-Inteligencia Nexus
                    </h2>
                    <p className="text-sm text-slate-500 font-light">Distribución geográfica de clientes y áreas de influencia</p>
                </div>
                <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2">
                    <MapPin size={14} />
                    {clients.length} Clientes Localizados
                </div>
            </div>

            <div className="h-[500px] w-full bg-slate-100 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-inner relative z-0">
                <MapContainer
                    center={[40.4168, -3.7038]} // Madrid as default center
                    zoom={6}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {clients.map(client => (
                        <Marker
                            key={client.id}
                            position={[client.latitude, client.longitude]}
                            icon={customIcon}
                        >
                            <Popup>
                                <div className="p-1">
                                    <h4 className="font-bold text-slate-900 mb-1">{client.name}</h4>
                                    <p className="text-xs text-slate-500 mb-2">{client.city || 'Ubicación'}</p>
                                    <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">
                                        Ver Detalles
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
};
