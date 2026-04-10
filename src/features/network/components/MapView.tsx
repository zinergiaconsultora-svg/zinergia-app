'use client';

import React, { useEffect, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { geocodeClientsAction, GeocodeResult } from '@/app/actions/geo';
import { MapPin, Navigation, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

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

function GeocodeButton({ onDone }: { onDone: () => void }) {
    const [isPending, start] = useTransition();
    const [result, setResult] = useState<GeocodeResult | null>(null);

    const handleGeocode = () => start(async () => {
        try {
            const r = await geocodeClientsAction();
            setResult(r);
            if (r.updated > 0) {
                toast.success(`${r.updated} cliente${r.updated !== 1 ? 's' : ''} geocodificado${r.updated !== 1 ? 's' : ''}`);
                onDone();
            } else {
                toast.info(r.total === 0 ? 'Todos los clientes ya están localizados' : 'No se pudieron geocodificar los clientes');
            }
        } catch (e) {
            toast.error((e as Error).message);
        }
    });

    if (result) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-100">
                <CheckCircle2 size={13} />
                {result.updated}/{result.total} geocodificados
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={handleGeocode}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-60"
        >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {isPending ? 'Geocodificando...' : 'Geocodificar clientes'}
        </button>
    );
}

export const MapView: React.FC = () => {
    const router = useRouter();
    const [clients, setClients] = useState<GeoClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [L, setL] = useState<typeof import('leaflet') | null>(null);

    const loadClients = async () => {
        try {
            const data = await crmService.getGeolocatedClients();
            setClients(data as GeoClient[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            import('leaflet').then(leaflet => setL(leaflet));
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

    const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Navigation size={20} className="text-indigo-600" />
                        Mapa de Clientes
                    </h2>
                    <p className="text-sm text-slate-500 font-light">Distribución geográfica de tu cartera</p>
                </div>
                <div className="flex items-center gap-2">
                    <GeocodeButton onDone={() => { setLoading(true); loadClients(); }} />
                    <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2">
                        <MapPin size={14} />
                        {clients.length} localizados
                    </div>
                </div>
            </div>

            {clients.length === 0 && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                    <p>Ningún cliente tiene coordenadas aún. Pulsa <strong>Geocodificar clientes</strong> para localizarlos automáticamente a partir de su ciudad y código postal.</p>
                </div>
            )}

            <div className="h-[500px] w-full bg-slate-100 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-inner relative z-0">
                <MapContainer
                    center={[40.4168, -3.7038]}
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
                                    <p className="text-xs text-slate-500 mb-2">{client.city ?? 'Ubicación'}</p>
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                                    >
                                        Ver detalles →
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
