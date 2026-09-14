import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const DEPARTMENTS = ['16', '18', '23', '24', '36', '37', '41', '79', '85', '86', '87'];

async function buildInseeToPostalMap() {
  const map = {};
  for (const dept of DEPARTMENTS) {
    try {
      const resp = await fetch(`https://geo.api.gouv.fr/communes?codeDepartement=${dept}&fields=code,codesPostaux,nom&format=json&limit=1000`);
      const communes = await resp.json();
      for (const c of communes) {
        if (c.codesPostaux && c.codesPostaux.length > 0) {
          map[c.code] = c.codesPostaux;
        }
      }
    } catch (e) {
      console.error(`Erreur dept ${dept}: ${e.message}`);
    }
  }
  return map;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé aux administrateurs' }, { status: 403 });

    // Step 1: Build INSEE → postal code mapping
    const inseeMap = await buildInseeToPostalMap();

    // Step 2: Read structure_commerciale and build postal → commercial IDs map
    const structure = await base44.asServiceRole.entities.structure_commerciale.list('-nom_commercial', 100);
    const postalToCommercialIds = {}; // postal code → [structureId, ...]
    const commercialStats = [];

    for (const s of structure) {
      const inseeCodes = s.codes_communes || [];
      const postalCodes = new Set();
      for (const code of inseeCodes) {
        const postals = inseeMap[code];
        if (postals) postals.forEach(p => postalCodes.add(p));
      }
      const postalArray = [...postalCodes];
      for (const p of postalArray) {
        if (!postalToCommercialIds[p]) postalToCommercialIds[p] = [];
        postalToCommercialIds[p].push(s.id);
      }
      commercialStats.push({ nom: s.nom_commercial, id: s.id, insee: inseeCodes.length, postal: postalArray.length });
    }

    // Step 3: Fetch ALL clients (paginated)
    const allClients = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.client.list('-created_date', 500, offset);
      allClients.push(...batch);
      offset += batch.length;
      hasMore = batch.length === 500;
    }

    // Step 4: Build bulkUpdate list
    const updates = [];
    let matchedCount = 0;
    for (const c of allClients) {
      const code = c.code_commune;
      if (!code) continue;
      const commercialIds = postalToCommercialIds[code];
      if (!commercialIds || commercialIds.length === 0) continue;

      // Merge existing assignments with new ones
      const existing = c.commerciaux_assignes || [];
      const merged = [...new Set([...existing, ...commercialIds])];
      // Only update if something changed
      if (merged.length !== existing.length) {
        updates.push({ id: c.id, commerciaux_assignes: merged });
        matchedCount++;
      }
    }

    // Step 5: Bulk update (batch of 500)
    let updatedCount = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.client.bulkUpdate(batch);
      updatedCount += batch.length;
    }

    return Response.json({
      success: true,
      mappingSize: Object.keys(inseeMap).length,
      totalClients: allClients.length,
      matchedClients: matchedCount,
      updatedClients: updatedCount,
      commercials: commercialStats
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}