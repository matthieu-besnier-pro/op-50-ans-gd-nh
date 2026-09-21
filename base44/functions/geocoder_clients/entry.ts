import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';
import { deptFromClient, deptCentroid, coordDansDept } from '../../shared/geo.ts';

// Placement des clients sur la carte, ancré sur le CODE POSTAL → DÉPARTEMENT.
// - Les coordonnées sources (export SIV) ne sont PAS fiables : on les VALIDE contre
//   le département ; si elles tombent hors du département, on les rejette.
// - Un point rejeté (ou manquant) est placé immédiatement au CENTRE du département
//   (bon secteur garanti), puis affiné en arrière-plan par géocodage précis (rue/commune).

const UA = { 'User-Agent': 'CockpitOP-GD/1.0 (gonnin-duris.fr)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&countrycodes=fr`,
      { headers: UA }
    );
    const data = await res.json();
    await sleep(1100);
    if (data && data[0]) {
      const pc = (data[0].address && data[0].address.postcode) ? String(data[0].address.postcode).replace(/\s/g, '') : '';
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), dept: pc.slice(0, 2) };
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Géocodage précis, validé sur le département attendu.
async function geocodePrecis(c) {
  const adr = c.adresse_complete || '';
  const dept = deptFromClient(c);
  const cp = (adr.match(/\b(\d{5})\b/) || [])[1];
  const parts = adr.split(',').map((s) => s.trim()).filter(Boolean);
  let ville = parts.length ? parts[parts.length - 1] : '';
  ville = ville.replace(/\b\d{5}\b/, '').trim();
  const okDept = (r) => r && (!dept || !r.dept || r.dept === dept);

  if (adr) {
    const r = await nominatim(`${adr}, France`);
    if (okDept(r)) return r;
  }
  if (cp) {
    const r = await nominatim(`${cp} ${ville} France`.replace(/\s+/g, ' ').trim());
    if (okDept(r)) return r;
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
    const toRefine = [];

    clients.filter(Boolean).forEach((c) => {
      const dept = deptFromClient(c);
      const hasStored = c.latitude != null && c.longitude != null;
      const base = { raison_sociale: c.raison_sociale, adresse: c.adresse_complete || '' };

      if (hasStored && coordDansDept(c.latitude, c.longitude, dept)) {
        // Coordonnées sources cohérentes avec le département → on les garde
        coords[c.id] = { lat: c.latitude, lng: c.longitude, ...base };
      } else {
        const ctr = deptCentroid(dept);
        if (ctr) {
          // Placement immédiat au centre du département, puis affinage
          coords[c.id] = { lat: ctr[0], lng: ctr[1], approx: true, ...base };
          toRefine.push(c);
        } else if (hasStored) {
          // Pas de département identifiable → on garde le stored faute de mieux
          coords[c.id] = { lat: c.latitude, lng: c.longitude, ...base };
        } else {
          toRefine.push(c);
        }
      }
    });

    // Affinage précis en arrière-plan (max 10, ~1 req/s), persiste des coords précises et validées
    const batch = toRefine.slice(0, 10);
    if (batch.length > 0) {
      waitUntil((async () => {
        for (const c of batch) {
          const hit = await geocodePrecis(c);
          if (hit && !isNaN(hit.lat) && !isNaN(hit.lon)) {
            await base44.asServiceRole.entities.client.update(c.id, { latitude: hit.lat, longitude: hit.lon }).catch(() => {});
          }
        }
      })());
    }

    return Response.json({
      coords,
      geocoding_pending: toRefine.length,
      cached_count: Object.keys(coords).length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
