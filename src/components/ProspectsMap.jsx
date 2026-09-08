import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { MapPin, Wrench, User, Loader2, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Pin SVG custom (orange GD)
const pinIcon = L.divIcon({
  html: `<div style="transform: translate(-50%, -100%);">
    <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 20 14 20s14-10.5 14-20C28 6.27 21.73 0 14 0z" fill="#FFC107" stroke="#00356B" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#00356B"/>
    </svg>
  </div>`,
  className: 'gd-pin',
  iconSize: [28, 34],
  iconAnchor: [14, 34],
  popupAnchor: [0, -34]
});

const pinIconAtelier = L.divIcon({
  html: `<div style="transform: translate(-50%, -100%);">
    <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 20 14 20s14-10.5 14-20C28 6.27 21.73 0 14 0z" fill="#00356B" stroke="#FFC107" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#FFC107"/>
    </svg>
  </div>`,
  className: 'gd-pin-atelier',
  iconSize: [28, 34],
  iconAnchor: [14, 34],
  popupAnchor: [0, -34]
});

function FitBounds({ clients }) {
  const map = useMap();
  useEffect(() => {
    const withCoords = clients.filter((c) => c.lat != null && c.lng != null);
    if (withCoords.length === 1) {
      map.setView([withCoords[0].lat, withCoords[0].lng], 11);
    } else if (withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [clients, map]);
  return null;
}

export default function ProspectsMap({ rdvs, clients, users, canFilter }) {
  const navigate = useNavigate();
  const [coords, setCoords] = useState({});
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [commercialFilter, setCommercialFilter] = useState('all');
  const mapRef = useRef(null);

  // RDV with future dates (today onward) — prospects to visit
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingRdvs = useMemo(() => {
    let list = rdvs.filter((r) => r.date_heure && r.date_heure.slice(0, 10) >= todayStr && r.statut !== 'Annulé');
    if (canFilter && commercialFilter !== 'all') {
      list = list.filter((r) => r.commercial_id === commercialFilter);
    }
    return list;
  }, [rdvs, todayStr, canFilter, commercialFilter]);

  const clientIds = useMemo(() => [...new Set(upcomingRdvs.map((r) => r.client_id))], [upcomingRdvs]);

  // Geocode via backend function
  useEffect(() => {
    if (clientIds.length === 0) {
      setCoords({});
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    base44.functions.invoke('geocoder_clients', { client_ids: clientIds })
      .then((res) => {
        if (!active) return;
        setCoords(res.data.coords || {});
        setPendingCount(res.data.geocoding_pending || 0);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientIds.join(',')]);

  // Build map markers: merge coords with client info + next RDV
  const markers = useMemo(() => {
    return Object.entries(coords)
      .filter(([, c]) => c.lat != null && c.lng != null)
      .map(([clientId, c]) => {
        const clientRdvs = upcomingRdvs.filter((r) => r.client_id === clientId).sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));
        const nextRdv = clientRdvs[0];
        const client = clients[clientId];
        return {
          id: clientId,
          lat: c.lat,
          lng: c.lng,
          raison_sociale: c.raison_sociale || client?.raison_sociale || 'Client',
          adresse: c.adresse || client?.adresse_complete || '',
          rdvs: clientRdvs,
          nextRdv
        };
      })
      .filter((m) => m.nextRdv); // only show clients with upcoming RDV
  }, [coords, upcomingRdvs, clients]);

  const commercialOptions = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [users]);

  const rdvCommercialIds = useMemo(() => [...new Set(upcomingRdvs.map((r) => r.commercial_id))], [upcomingRdvs]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-gd-orange" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Carte des prospects ({markers.length})
          </h2>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {pendingCount} géocodage(s) en cours…
            </span>
          )}
        </div>
        {canFilter && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={commercialFilter} onValueChange={setCommercialFilter}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Tous les commerciaux" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les commerciaux</SelectItem>
                {rdvCommercialIds.map((id) => (
                  <SelectItem key={id} value={id}>{commercialOptions[id]?.full_name || 'Commercial'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg bg-muted/30">
          <Loader2 className="h-8 w-8 animate-spin text-gd-navy" />
        </div>
      ) : markers.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
          Aucun prospect géocodé pour le moment. {pendingCount > 0 && 'Géocodage en cours, réactualisez dans quelques instants.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border" style={{ height: 400 }}>
          <MapContainer center={[46.6, 2.5]} zoom={6} style={{ height: '100%', width: '100%' }} ref={mapRef}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <FitBounds clients={markers} />
            {markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={m.nextRdv?.type === 'RDV atelier hivernage' ? pinIconAtelier : pinIcon}>
                <Popup>
                  <div className="min-w-[200px]">
                    <p className="font-bold text-gd-navy">{m.raison_sociale}</p>
                    {m.adresse && <p className="text-xs text-muted-foreground">{m.adresse}</p>}
                    {m.nextRdv && (
                      <div className="mt-2 rounded bg-muted/50 p-2">
                        <p className="flex items-center gap-1 text-xs font-semibold text-gd-navy">
                          {m.nextRdv.type === 'RDV atelier hivernage' ? <Wrench className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {new Date(m.nextRdv.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(m.nextRdv.date_heure).getHours()}h{String(new Date(m.nextRdv.date_heure).getMinutes()).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.nextRdv.type}</p>
                      </div>
                    )}
                    {m.rdvs.length > 1 && <p className="mt-1 text-xs text-muted-foreground">{m.rdvs.length} RDV planifiés</p>}
                    <button
                      onClick={() => navigate(`/client/${m.id}`)}
                      className="mt-2 w-full rounded bg-gd-navy px-2 py-1 text-xs font-semibold text-white hover:bg-gd-navy-dark"
                    >
                      Voir la fiche
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-gd-orange border border-gd-navy" /> RDV commercial</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-gd-navy border border-gd-orange" /> RDV atelier</span>
      </div>
    </div>
  );
}