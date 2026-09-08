import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';

// Géocode les clients via Nominatim (OpenStreetMap, gratuit).
// Retourne immédiatement les coordonnées déjà en cache (latitude/longitude).
// Géocode en arrière-plan (max 10 par appel, 1 req/sec) les clients sans coordonnées
// et les stocke sur l'entité — ils apparaîtront au prochain rafraîchissement.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const clientIds = Array.isArray(body.client_ids) ? body.client_ids.slice(0, 200) : [];

    const clients = await Promise.all(
      clientIds.map((id) => base44.asServiceRole.entities.client.get(id).catch(() => null))
    );

    const coords = {};
    const toGeocode = [];

    clients.filter(Boolean).forEach((c) => {
      if (c.latitude != null && c.longitude != null) {
        coords[c.id] = {
          lat: c.latitude,
          lng: c.longitude,
          raison_sociale: c.raison_sociale,
          adresse: c.adresse_complete || ''
        };
      } else {
        toGeocode.push(c);
      }
    });

    // Géocodage en arrière-plan (respecte la politique Nominatim : 1 req/sec)
    const batch = toGeocode.slice(0, 10);
    if (batch.length > 0) {
      waitUntil((async () => {
        for (const c of batch) {
          try {
            const query = encodeURIComponent(
              [c.adresse_complete, c.code_commune, 'France'].filter(Boolean).join(', ')
            );
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=fr`,
              { headers: { 'User-Agent': 'NH50-GD-Tracker/1.0 (gonnin-duris.fr)' } }
            );
            const data = await res.json();
            if (data && data[0]) {
              await base44.asServiceRole.entities.client.update(c.id, {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon)
              });
            }
          } catch (e) {
            // skip ce client
          }
          await new Promise((r) => setTimeout(r, 1100));
        }
      })());
    }

    return Response.json({
      coords,
      geocoding_pending: toGeocode.length,
      cached_count: Object.keys(coords).length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}