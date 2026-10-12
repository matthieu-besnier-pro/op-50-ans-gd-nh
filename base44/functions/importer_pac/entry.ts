import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { computeScore } from "../../shared/score.ts";

export default async function(req) {
  let stage = 'init';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé admin' }, { status: 403 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    // 1. Fetch HTML and extract DATA array
    let resp;
    try {
      resp = await fetch(file_url);
    } catch (e) {
      return Response.json({ error: `Téléchargement impossible (fetch a échoué) — file_url=${String(file_url).slice(0, 140)} — ${e?.message || e}` }, { status: 500 });
    }
    if (!resp.ok) {
      return Response.json({ error: `Téléchargement du fichier PAC échoué (HTTP ${resp.status}) — file_url=${String(file_url).slice(0, 140)}` }, { status: 500 });
    }
    const html = await resp.text();
    stage = 'html';
    const dataMatch = html.match(/const DATA=(\[[\s\S]*?\]);/);
    if (!dataMatch) return Response.json({ error: 'Array DATA introuvable dans le HTML' }, { status: 400 });
    const pacRecords = JSON.parse(dataMatch[1]);

    // 2. Index PAC : SIREN (col 1) → montant total € (col 8), et raison sociale (col 0)
    //    pour le repli quand le SIREN du client ne figure pas dans le fichier.
    const normNom = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const pacMap = new Map();
    const pacByNom = new Map();
    for (const r of pacRecords) {
      const siren = String(r[1] || '').trim();
      const montant = parseFloat(r[8]) || 0;
      if (siren) pacMap.set(siren, montant);
      const nom = normNom(r[0]);
      if (nom) {
        const cur = pacByNom.get(nom) || { total: 0, n: 0 };
        pacByNom.set(nom, { total: cur.total + montant, n: cur.n + 1 });
      }
    }

    // 3. Tous les clients — pagination par curseur (l'offset renvoie des doublons
    //    et laisse des fiches de côté : elles restaient sans PAC).
    const allClients = [];
    let cursor = null;
    do {
      const page = await base44.asServiceRole.entities.client.filter({}, {
        sort: '-created_date',
        limit: 500,
        cursor,
        fields: ['id', 'siren', 'raison_sociale', 'montant_pac', 'usage_pac_autorise', 'beneficiaire_pac_certain', 'score_appetence', 'niveau_appetence']
      });
      allClients.push(...page.items);
      stage = `clients:${allClients.length}`;
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor && allClients.length < 50000);

    // 4. Tout le matériel — pagination par curseur (mêmes doublons sinon).
    const allMachines = [];
    cursor = null;
    do {
      const page = await base44.asServiceRole.entities.materiel.filter({}, {
        sort: '-created_date',
        limit: 500,
        cursor,
        fields: ['client_id', 'prochain_achat', 'premiere_immat', 'annee_immat', 'date_fin_vie']
      });
      allMachines.push(...page.items);
      stage = `machines:${allMachines.length}`;
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor && allMachines.length < 50000);

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
    let matchedParNom = 0;
    let updated = 0;
    const updates = [];
    for (const c of allClients) {
      const siren = String(c.siren || '').replace(/\D/g, '').slice(0, 9);
      let pacMontant = siren.length === 9 ? pacMap.get(siren) : undefined;
      let viaNom = false;
      if (pacMontant === undefined) {
        // Repli : même raison sociale, à condition qu'elle soit unique dans le fichier PAC.
        const hit = pacByNom.get(normNom(c.raison_sociale));
        if (hit && hit.n === 1) { pacMontant = hit.total; viaNom = true; }
      }
      const hasPac = pacMontant !== undefined;
      if (viaNom) matchedParNom++;

      const materiels = machinesByClient[c.id] || [];
      const { score, niveau } = computeScore(
        { ...c, montant_pac: hasPac ? pacMontant : c.montant_pac, usage_pac_autorise: hasPac ? true : c.usage_pac_autorise },
        materiels
      );

      // On n'écrit que si la fiche change vraiment : sinon chaque import réécrivait
      // les 3 500 clients croisés et dépassait le temps limite de la fonction.
      const changementPac = hasPac && (c.montant_pac !== pacMontant || c.usage_pac_autorise !== true);
      const needsUpdate = changementPac || score !== c.score_appetence || niveau !== c.niveau_appetence;
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

    // 7. Mise à jour par lots. Un lot peut tomber sur un timeout MongoDB : on le
    //    retente, et si ça échoue encore on continue — un nouvel import reprend le reste.
    let lotsEchoues = 0;
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      stage = `updates:${i}`;
      let ok = false;
      for (let essai = 0; essai < 3 && !ok; essai++) {
        try {
          await base44.asServiceRole.entities.client.bulkUpdate(batch);
          ok = true;
        } catch (e) {
          if (essai === 2) { lotsEchoues++; } else { await new Promise((r) => setTimeout(r, 500)); }
        }
      }
      if (ok) updated += batch.length;
    }

    return Response.json({
      pac_records: pacRecords.length,
      pac_with_siren: pacMap.size,
      total_clients: allClients.length,
      clients_matched_pac: matched,
      clients_matched_nom: matchedParNom,
      clients_updated: updated,
      lots_en_echec: lotsEchoues,
      restant_a_traiter: updates.length - updated,
      total_machines: allMachines.length
    });
  } catch (error) {
    return Response.json({ error: `[importer_pac] ${error?.message || String(error)}`, stage }, { status: 500 });
  }
}