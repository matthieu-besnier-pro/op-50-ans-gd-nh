import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';

// Géocode les clients via Nominatim (OpenStreetMap, gratuit).
// Stratégie d'emplacement : on ancre d'abord sur le CODE POSTAL (→ département),
// puis on affine sur la rue. On VÉRIFIE que le résultat tombe bien dans le bon
// département ; sinon on se replie sur le centre de la commune (CP + ville), puis
// sur le centre du code postal. Objectif : jamais un point dans la mauvaise
// commune homonyme.

const UA = { 'User-Agent': 'CockpitOP-GD/1.0 (gonnin-duris.fr)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&countrycodes=fr`,
      { headers: UA }
    );
    const data = await res.json();
    await sleep(1100); // politique Nominatim : max ~1 req/s
    if (data && data[0]) {
      const pc = (data[0].address && data[0].address.postcode) ? String(data[0].address.postcode).replace(/\s/g, '') : '';
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), dept: pc.slice(0, 2) };
    }
  } catch (e) { /* ignore */ }
  return null;
}

function extract(c) {
  const adr = c.adresse_complete || '';
  const cp = (adr.match(/\b(\d{5})\b/) || [])[1]
    || (/^\d{5}$/.test(c.code_commune || '') ? c.code_commune : null);
  let dept = cp ? cp.slice(0, 2) : null;
  if (!dept && c.departement) dept = String(c.departement).replace(/\D/g, '').padStart(2, '0').slice(0, 2);
  // Ville = dernier segment de l'adresse, code postal retiré
  const parts = adr.split(',').map((s) => s.trim()).filter(Boolean);
  let ville = parts.length ? parts[parts.length - 1] : '';
  ville = ville.replace(/\b\d{5}\b/, '').trim();
  return { adr, cp, dept, ville };
}

async function geocodeClient(c) {
  const { adr, cp, dept, ville } = extract(c);
  const okDept = (r) => r && (!dept || !r.dept || r.dept === dept);

  // 1) Adresse complète (rue + CP + ville) — la plus précise
  if (adr) {
    const r = await nominatim(`${adr}, France`);
    if (okDept(r)) return r;
  }
  // 2) Repli : centre de la commune (CP + ville) — bon département garanti
  if (cp) {
    const r = await nominatim(`${cp} ${ville} France`.replace(/\s+/g, ' ').trim());
    if (okDept(r)) return r;
    // 3) Repli : centre du code postal
    const r2 = await nominatim(`${cp} France`);
    if (r2) return r2;
  }
  return null;
}

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
        coords[c.id] = { lat: c.latitude, lng: c.longitude, raison_sociale: c.raison_sociale, adresse: c.adresse_complete || '' };
      } else {
        toGeocode.push(c);
      }
    });

    // Géocodage en arrière-plan
    const batch = toGeocode.slice(0, 10);
    if (batch.length > 0) {
      waitUntil((async () => {
        for (const c of batch) {
          const hit = await geocodeClient(c);
          if (hit && !isNaN(hit.lat) && !isNaN(hit.lon)) {
            await base44.asServiceRole.entities.client.update(c.id, { latitude: hit.lat, longitude: hit.lon }).catch(() => {});
          }
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
