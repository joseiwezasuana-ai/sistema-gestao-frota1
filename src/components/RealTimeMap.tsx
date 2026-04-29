import React, { useState, useEffect, useCallback } from 'react';
import GoogleMap from 'google-maps-react-markers';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToString } from 'react-dom/server';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Truck, Crosshair, Map as MapIcon, Globe, AlertCircle, Zap, User } from 'lucide-react';

// Fix for Leaflet default icon issues in React/Webpack/Vite
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map view changes dynamically
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const TaxiMarker = ({ driver, ...props }: any) => {
  const isSpeeding = driver.speed > 85;

  const getMarkerColor = (status: string) => {
    if (isSpeeding) return 'bg-red-600';
    switch (status?.toLowerCase()) {
      case 'available':
      case 'ativo':
      case 'disponível':
        return 'bg-green-600';
      case 'busy':
      case 'ocupado':
        return 'bg-amber-600';
      case 'offline':
      case 'inativo':
      case 'indisponível':
        return 'bg-red-600';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className={`group relative -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 ${isSpeeding ? 'z-[100]' : 'z-10'}`}>
      {isSpeeding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-red-500/40 rounded-full animate-ping pointer-events-none" />
      )}
      <div className={`p-1.5 rounded-lg border-2 border-white shadow-xl text-white transition-all hover:scale-125 hover:z-50 ${getMarkerColor(driver.status)} ${isSpeeding ? 'animate-pulse shadow-red-500/50 shadow-lg' : ''}`}>
        <div className="flex flex-col items-center">
          {isSpeeding ? <Zap size={14} className="text-white fill-white" /> : <Truck size={14} fill="currentColor" fillOpacity={0.2} />}
          <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5 whitespace-nowrap px-1 bg-black/20 rounded-sm">
            {driver.prefix}
          </span>
        </div>
      </div>
    
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white p-3 rounded-xl shadow-2xl border border-slate-200 hidden group-hover:block z-[9999] min-w-[180px]">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
          <div className={`w-2.5 h-2.5 rounded-full ${getMarkerColor(driver.status)} ${isSpeeding ? 'animate-pulse' : ''}`} />
          <p className="font-black text-[11px] text-slate-900 uppercase tracking-tighter">
            {driver.prefix} • {driver.speed || 0} KM/H
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <User size={12} className="text-slate-400" />
            <p className="text-[10px] text-slate-700 font-bold truncate">{driver.name}</p>
          </div>
          {isSpeeding && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-2 py-1 rounded-lg">
              <AlertCircle size={10} />
              <p className="text-[9px] font-black uppercase tracking-widest">ALERTA DE VELOCIDADE!</p>
            </div>
          )}
          <p className="text-[9px] text-slate-400 font-medium italic">{driver.phone || '+244 ...'}</p>
        </div>
        <div className="w-2 h-2 bg-white border-r border-b border-slate-200 absolute rotate-45 left-1/2 -translate-x-1/2 -bottom-1" />
      </div>
    </div>
  );
};

const createLeafletIcon = (driver: any) => {
  const html = renderToString(<TaxiMarker driver={driver} />);
  return L.divIcon({
    html,
    className: 'custom-taxi-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function RealTimeMap() {
  const [useGoogleMaps, setUseGoogleMaps] = useState(false); // Default to Leaflet (OpenStreetMap)
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);

  const [mapConfig, setMapConfig] = useState({
    center: [-11.7833, 19.9167] as [number, number],
    zoom: 14
  });
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');

  useEffect(() => {
    // Detect Google Maps Authentication/Configuration Failures
    // @ts-ignore
    window.gm_authFailure = () => {
      console.error("Google Maps API failed to authenticate.");
      setGoogleMapsError('ApiTargetBlockedMapError');
      
      // Auto-fallback to OpenStreetMap after a short delay
      setTimeout(() => {
        setUseGoogleMaps(false);
      }, 3000);
    };

    return () => {
      // @ts-ignore
      window.gm_authFailure = null;
    };
  }, []);

  useEffect(() => {
    // Detect if key is present to inform the user, but don't auto-switch anymore
    // as per user request for a map that works "out of the box"
    if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY && !googleMapsError) {
      console.log("Google Maps API Key detected, but using OpenStreetMap by default for reliability.");
    }
  }, [googleMapsError]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map((doc, idx) => {
        const data = doc.data();
        // Add a tiny jitter if multiple vehicles use the default coordinate to avoid overlapping
        const jitter = idx * 0.0002;
        return { 
          id: doc.id, 
          ...data,
          lat: Number(data.lat || -11.7833 + jitter),
          lng: Number(data.lng || 19.9167 + jitter)
        };
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));
    return () => unsub();
  }, []);

  const handleLocateDriver = useCallback((driver: any) => {
    const coords: [number, number] = [Number(driver.lat), Number(driver.lng)];
    setMapConfig({
      center: coords,
      zoom: 17
    });
  }, []);

  const filteredDrivers = drivers.filter(d => 
    statusFilter === 'all' || d.status === statusFilter
  );

  const mapCenterArray = mapConfig.center;

  const showGoogleError = googleMapsError || (useGoogleMaps && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-6 py-4 rounded-lg border border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Mapa de Frota - Moxico</h2>
          <p className="text-xs text-slate-500 font-medium">Localização em tempo real das unidades operacionais</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex p-0.5 bg-slate-100 rounded-md border border-slate-200">
            <button 
              onClick={() => setUseGoogleMaps(false)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${!useGoogleMaps ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <MapIcon size={12} /> Mapa Padrão
            </button>
            <button 
              onClick={() => setUseGoogleMaps(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${useGoogleMaps ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Globe size={12} /> Satélite (Google)
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <div className="flex gap-1.5">
            {['all', 'available', 'busy', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  statusFilter === status 
                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status === 'all' ? 'Todos' : 
                status === 'available' ? 'Livre' : 
                status === 'busy' ? 'Ocupado' : 'Off'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[500px]">
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden relative z-0">
          {showGoogleError && (
            <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-8 text-center">
              <div className="max-w-md bg-white p-6 rounded-xl shadow-2xl">
                <div className="bg-amber-100 text-amber-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  {googleMapsError ? <AlertCircle size={24} /> : <Globe size={24} />}
                </div>
                <h4 className="text-slate-900 font-bold mb-2">
                  {googleMapsError ? 'Erro de Configuração Google' : 'Configuração Necessária'}
                </h4>
                <div className="text-slate-500 text-sm mb-6 text-left space-y-3">
                  {googleMapsError === 'ApiTargetBlockedMapError' ? (
                    <>
                      <p className="font-bold text-amber-600">O Google Maps está bloqueado para o seu projeto.</p>
                      <p>Para corrigir, siga estes passos no Google Cloud Console:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Aceda à <a href="https://console.cloud.google.com/google/maps-apis/library" target="_blank" className="text-brand-primary underline">Biblioteca de APIs</a>.</li>
                        <li>Pesquise por <strong>"Maps JavaScript API"</strong>.</li>
                        <li>Clique em <strong>ATIVAR</strong> (Enable).</li>
                        <li>Verifique se a <strong>Faturação</strong> (Billing) está ativa.</li>
                      </ol>
                    </>
                  ) : !import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                    <p>A chave de API não foi configurada. Use o modo <strong>OpenMap</strong> ou configure o <code>VITE_GOOGLE_MAPS_API_KEY</code> nos Segredos.</p>
                  ) : (
                    <p>Ocorreu um problema ao carregar o Google Maps. Verifique se a API está ativa e se as restrições de IP/Domínio estão corretas.</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      setUseGoogleMaps(false);
                      setGoogleMapsError(null);
                    }}
                    className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-dark transition-colors"
                  >
                    Continuar com OpenStreetMap
                  </button>
                  <button 
                    onClick={() => window.open('https://console.cloud.google.com/google/maps-apis/library', '_blank')}
                    className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors text-sm"
                  >
                    Abrir Dashboard do Google Cloud
                  </button>
                </div>
                {import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                   <p className="mt-4 text-[10px] text-slate-400">
                     Certifique-se de que a "Maps JavaScript API" está ATIVA no seu painel Google Cloud.
                   </p>
                )}
              </div>
            </div>
          )}

          {useGoogleMaps && !googleMapsError ? (
            <div className="h-full w-full">
              <GoogleMap
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
                defaultCenter={typeof mapConfig.center === 'object' && !Array.isArray(mapConfig.center) ? mapConfig.center : { lat: -11.7833, lng: 19.9167 }}
                defaultZoom={mapConfig.zoom}
                center={typeof mapConfig.center === 'object' && !Array.isArray(mapConfig.center) ? mapConfig.center : { lat: -11.7833, lng: 19.9167 }}
                zoom={mapConfig.zoom}
                onGoogleApiLoaded={() => console.log('Google Maps API Loaded')}
                mapMinHeight="100%"
              >
                {filteredDrivers.map(driver => (
                  <TaxiMarker 
                    key={driver.id} 
                    lat={driver.lat} 
                    lng={driver.lng} 
                    driver={driver}
                  />
                ))}
              </GoogleMap>
            </div>
          ) : (
            <div className="h-full w-full">
              <MapContainer 
                center={mapCenterArray} 
                zoom={mapConfig.zoom} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <ChangeView center={mapCenterArray} zoom={mapConfig.zoom} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredDrivers.map(driver => (
                  <Marker 
                    key={driver.id} 
                    position={[driver.lat, driver.lng]}
                    icon={createLeafletIcon(driver)}
                    eventHandlers={{
                      click: () => handleLocateDriver(driver)
                    }}
                  >
                    <Popup offset={[0, -10]}>
                      <div className="p-1">
                        <p className="font-bold text-blue-700 text-xs mb-1">{driver.prefix}</p>
                        <p className="text-[10px] text-slate-800 font-medium">{driver.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Status: {driver.status}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-[13px] text-slate-900 flex items-center gap-2 uppercase tracking-wider">
              <Truck size={14} className="text-brand-primary" />
              Frota Online ({filteredDrivers.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredDrivers.map(driver => (
              <div 
                key={driver.id} 
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between"
                onClick={() => handleLocateDriver(driver)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-slate-800">{driver.prefix}</p>
                    <div className={`w-2 h-2 rounded-full ${
                      ['available', 'ativo', 'disponível'].includes(driver.status?.toLowerCase()) ? 'bg-green-500' : 
                      ['busy', 'ocupado'].includes(driver.status?.toLowerCase()) ? 'bg-amber-500' : 
                      ['offline', 'inativo', 'indisponível'].includes(driver.status?.toLowerCase()) ? 'bg-red-500' : 'bg-slate-300'
                    }`} />
                  </div>
                  <p className="text-[11px] text-slate-500">{driver.name}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLocateDriver(driver);
                  }}
                  title="Localizar Motorista"
                  className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-light rounded-md transition-all active:scale-95 shadow-sm bg-white border border-slate-100"
                >
                  <Crosshair size={14} />
                </button>
              </div>
            ))}
            {filteredDrivers.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-xs text-slate-400 italic">Nenhum motorista encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
