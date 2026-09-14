import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { computeScore } from "../../shared/score.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé admin' }, { status: 403 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    // 1. Fetch HTML and extract DATA array
    const resp = await fetch(file_url);
    const html = await resp.text();
    const dataMatch = html.match(/const DATA=(\[[\s\S]*?\]);/);
    if (!dataMatch) return Response.json({ error: 'Array DATA introuvable dans le HTML' }, { status: 400 });
    const pacRecords = JSON.parse(dataMatch[1]);

    // 2. Build SIREN → montant_pac map (col 1 = SIREN, col 8 = Total €)
    const pacMap = new Map();
    for (const r of pacRecords) {
      const siren = String(r[1] || '').trim();
      if (!siren) continue;
      const montant = parseFloat(r[8]) || 0;
      pacMap.set(siren, montant);
    }

    // 3. Fetch all clients (paginated)
    const allClients = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore && allClients.length < 50000) {
      const batch = await base44.asServiceRole.entities.client.list('-created_date', 500, offset);
      allClients.push(...batch);
      offset += batch.length;
      hasMore = batch.length === 500;
    }

    // 4. Fetch all machines (paginated)
    const allMachines = [];
    offset = 0;
    hasMore = true;
    while (hasMore && allMachines.length < 50000) {
      const batch = await base44.asServiceRole.entities.materiel.list('-created_date', 500, offset);
      allMachines.push(...batch);
      offset += batch.length;
      hasMore = batch.length === 500;
    }

    // 5. Group machines by client_id
    const machinesByClient = {};
    for (const m of allMachines) {
      const cid = m.client_id;
      if (!cid) continue;
      if (!machinesByClient[cid]) machinesByClient[cid] = [];
      machinesByClient[cid].push(m);
    }

    // 6. Prepare updates: for each client, set montant_pac + recompute score
    let matched = 0;
    let updated = 0;
    const updates = [];
    for (const c of allClients) {
      const siren = String(c.siren || '').trim();
      const pacMontant = siren ? pacMap.get(siren) : undefined;
      const hasPac = pacMontant !== undefined;

      const materiels = machinesByClient[c.id] || [];
      const { score, niveau } = computeScore(
        { ...c, montant_pac: hasPac ? pacMontant : c.montant_pac, usage_pac_autorise: hasPac ? true : c.usage_pac_autorise },
        materiels
      );

      const needsUpdate = hasPac || score !== c.score_appetence || niveau !== c.niveau_appetence;
      if (hasPac) matched++;
      if (needsUpdate) {
        updates.push({
          id: c.id,
          score_appetence: score,
          niveau_appetence: niveau,
          ...(hasPac ? { montant_pac: pacMontant, usage_pac_autorise: true } : {})
        });
      }
    }

    // 7. Bulk update in batches of 500
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.client.bulkUpdate(batch);
      updated += batch.length;
    }

    return Response.json({
      pac_records: pacRecords.length,
      pac_with_siren: pacMap.size,
      total_clients: allClients.length,
      clients_matched_pac: matched,
      clients_updated: updated,
      total_machines: allMachines.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}