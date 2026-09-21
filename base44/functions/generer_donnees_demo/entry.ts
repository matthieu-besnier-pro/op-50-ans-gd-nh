import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Données de démonstration, en mode "par paliers" pour rester sous la limite de débit Base44.
// L'interface appelle :
//   action 'nettoyer' en boucle jusqu'à { done:true }  (supprime le jeu de démo existant, par lots)
//   puis action 'creer' une fois                        (crée un nouveau jeu, volume modéré)
// Toutes les données créées sont taguées « DÉMO — » (clients, offres) → jamais mélangées aux vraies.

const PREFIX = 'DÉMO — ';
const DEL_BUDGET = 20; // suppressions max par appel
const MACHINES = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger'];
const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];
const REPRISES = ['Sans reprise', 'Reprise NH', 'Reprise autre marque'];
const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite', 'RDV obtenu', 'Devis en cours', 'Offre magasin à proposer', 'Vente conclue'];
const NOMS = ['EARL des Grands Champs', 'GAEC du Moulin', 'SCEA de la Prairie', 'CUMA de la Vallée', 'EARL Bellevue', 'Ferme des Trois Chênes', 'GAEC Terres Neuves', 'ETA Servibois', 'EARL du Verger', 'SCEA Les Peupliers', 'GAEC de la Fontaine', 'EARL Champ Fleuri', 'CUMA du Bocage', 'GAEC des Ormes'];
const COMMUNES = ['Melle', 'Niort', 'Issoudun', 'Naintré', 'Chasseneuil', 'Sauzé', 'Vasles', 'Châtillon'];
const MARQUES = ['New Holland', 'John Deere', 'Case IH', 'Fendt', 'Massey Ferguson', 'Claas'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const daysFromNow = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString(); };
const dateOnly = (iso) => iso.slice(0, 10);

async function listAll(entity, sr) {
  const out = []; let offset = 0;
  while (out.length < 100000) {
    const b = await sr.entities[entity].list('-created_date', 500, offset);
    if (!b || b.length === 0) break;
    out.push(...b); offset += b.length;
    if (b.length < 500) break;
  }
  return out;
}

// Un palier de nettoyage : supprime jusqu'à DEL_BUDGET enregistrements de démo, renvoie le reste.
async function nettoyerPalier(sr) {
  const demoClients = (await listAll('client', sr)).filter((c) => (c.raison_sociale || '').startsWith(PREFIX));
  const demoIds = new Set(demoClients.map((c) => c.id));
  const [rdvs, ventes, mats, offres] = await Promise.all([
    listAll('rdv', sr), listAll('vente', sr), listAll('materiel', sr), listAll('offre_magasin', sr)
  ]);
  // Ordre : dépendances d'abord, clients en dernier
  const cibles = [
    ...rdvs.filter((r) => demoIds.has(r.client_id)).map((r) => ['rdv', r.id]),
    ...ventes.filter((v) => demoIds.has(v.client_id)).map((v) => ['vente', v.id]),
    ...mats.filter((m) => demoIds.has(m.client_id)).map((m) => ['materiel', m.id]),
    ...offres.filter((o) => (o.titre || '').startsWith(PREFIX)).map((o) => ['offre_magasin', o.id]),
    ...demoClients.map((c) => ['client', c.id])
  ];
  const lot = cibles.slice(0, DEL_BUDGET);
  for (const [ent, id] of lot) {
    await sr.entities[ent].delete(id).catch(() => {});
    await sleep(120);
  }
  const restant = cibles.length - lot.length;
  return { done: restant <= 0, restant, supprimes_ce_palier: lot.length };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'nettoyer';
    const sr = base44.asServiceRole;

    // ---------- NETTOYAGE (à appeler en boucle) ----------
    if (action === 'nettoyer' || action === 'supprimer') {
      const res = await nettoyerPalier(sr);
      return Response.json({ ok: true, ...res });
    }

    // ---------- CREATION (un seul appel, volume modéré) ----------
    if (action === 'creer') {
      // Idempotent : si un jeu de démo existe déjà, on ne recrée rien (évite les doublons et le rate limit).
      const dejaClients = (await listAll('client', sr)).filter((c) => (c.raison_sociale || '').startsWith(PREFIX));
      if (dejaClients.length > 0 && !body.force) {
        return Response.json({ ok: true, deja_present: true, clients: dejaClients.length, note: 'Données de démo déjà présentes — rien recréé. Utilisez « Supprimer la démo » puis régénérez pour repartir de zéro.' });
      }

      const users = await listAll('User', sr);
      const commercials = users.filter((u) => u.app_role === 'commercial');
      const structure = await listAll('structure_commerciale', sr);
      const respByName = {};
      users.filter((u) => u.app_role === 'responsable').forEach((u) => { if (u.full_name) respByName[u.full_name.toLowerCase()] = u.id; });
      const managerByUser = {};
      structure.forEach((s) => { if (s.user_id && s.manager && respByName[s.manager.toLowerCase()]) managerByUser[s.user_id] = respByName[s.manager.toLowerCase()]; });

      // Badges (catalogue) si absent
      let badges = await listAll('badge', sr);
      if (badges.length === 0) {
        badges = await sr.entities.badge.bulkCreate([
          { nom: 'Premier RDV', description: '1er RDV obtenu', icone: '📅', condition_type: 'premier_rdv', condition_seuil: 1 },
          { nom: 'Sprint 13-14', description: '3 RDV pendant la prise de RDV', icone: '⚡', condition_type: 'sprint_13_14', condition_seuil: 3 },
          { nom: 'Closeur', description: '1re vente validée', icone: '🏆', condition_type: 'closeur', condition_seuil: 1 },
          { nom: 'Portefeuille nettoyé', description: 'Plus aucun client à contacter', icone: '🧹', condition_type: 'portefeuille_nettoye', condition_seuil: 1 },
          { nom: 'Chasseur de reprises', description: '5 reprises décrochées', icone: '🎯', condition_type: 'chasseur_reprises', condition_seuil: 5 },
          { nom: 'Premier devis', description: '1er devis saisi', icone: '📝', condition_type: 'premier_devis', condition_seuil: 1 }
        ]);
        await sleep(200);
      }

      // Paramètres opération (si non renseignés)
      const paramsList = await sr.entities.parametres_operation.list('-created_date', 1);
      const p = paramsList[0];
      const patch = {};
      if (!p || !p.date_debut_operation) patch.date_debut_operation = '2026-10-13';
      if (!p || !p.date_fin_operation) patch.date_fin_operation = '2026-10-30';
      if (!p || !p.date_debut_prise_rdv) patch.date_debut_prise_rdv = '2026-10-13';
      if (!p || !p.date_fin_prise_rdv) patch.date_fin_prise_rdv = '2026-10-14';
      if (!p || !p.objectif_rdv) patch.objectif_rdv = 120;
      if (!p || !p.objectif_ventes) patch.objectif_ventes = 40;
      if (!p || !p.objectif_ca_magasin) patch.objectif_ca_magasin = 150000;
      if (Object.keys(patch).length > 0) {
        if (p) await sr.entities.parametres_operation.update(p.id, patch);
        else await sr.entities.parametres_operation.create({ nom_operation: '50 ans Gonnin Duris × New Holland', ...patch });
        await sleep(200);
      }

      // Clients (volume modéré)
      const clientsPayload = NOMS.map((nom, i) => {
        const comm = commercials.length ? commercials[i % commercials.length] : null;
        const score = rndInt(10, 95);
        const niveau = score >= 66 ? 'Fort' : score >= 36 ? 'Moyen' : 'Faible';
        const ts = nom.startsWith('CUMA') ? 'CUMA' : nom.startsWith('ETA') ? 'ETA' : 'Exploitation';
        return {
          raison_sociale: PREFIX + nom, siren: 'DEMO' + (100000000 + i), type_structure: ts,
          adresse_complete: `${rndInt(1, 60)} route de ${rnd(COMMUNES)}, ${rnd(COMMUNES)}`,
          tel_mobile: '06' + rndInt(10000000, 99999999), sources_donnees: ['MISTRA'],
          type_client_mistra: Math.random() > 0.4 ? 'Client' : 'Prospect',
          statut: rnd(STATUTS), score_appetence: score, niveau_appetence: niveau,
          montant_devis: Math.random() > 0.7 ? rndInt(20000, 180000) : null,
          beneficiaire_pac_certain: ts === 'CUMA' || ts === 'ETA',
          commerciaux_assignes: comm ? [comm.id] : [],
          base_responsable_id: comm && managerByUser[comm.id] ? managerByUser[comm.id] : null
        };
      });
      const clients = await sr.entities.client.bulkCreate(clientsPayload);
      await sleep(250);

      // Matériel (1 par client)
      const materiels = clients.map((c) => ({
        client_id: c.id, marque: rnd(MARQUES), modele: 'T' + rndInt(4, 8) + '.' + rndInt(100, 320),
        occasion_neuf: Math.random() > 0.5 ? 'Neuf' : 'Occasion', statut_possession: 'Propriétaire', propriete: 'Propriétaire',
        age_estime: rndInt(1, 15), famille_materiel: 'Matériel agricole', commerciaux_assignes: c.commerciaux_assignes || []
      }));
      await sr.entities.materiel.bulkCreate(materiels);
      await sleep(250);

      // RDV : réalisés (dont aujourd'hui) + planifiés
      const rdvs = [];
      clients.forEach((c, i) => {
        const cid = c.commerciaux_assignes?.[0] || null;
        if (i % 2 === 0) rdvs.push({ client_id: c.id, commercial_id: cid, base_responsable_id: c.base_responsable_id, date_heure: daysFromNow(-rndInt(0, 12)), duree_minutes: 30, type: 'RDV commercial', statut: 'Réalisé' });
        if (i % 3 === 0) rdvs.push({ client_id: c.id, commercial_id: cid, base_responsable_id: c.base_responsable_id, date_heure: daysFromNow(rndInt(0, 10)), duree_minutes: 30, type: rnd(['RDV commercial', 'RDV atelier hivernage']), statut: 'Planifié' });
      });
      for (let j = 0; j < 3; j++) {
        const c = clients[j];
        rdvs.push({ client_id: c.id, commercial_id: c.commerciaux_assignes?.[0] || null, base_responsable_id: c.base_responsable_id, date_heure: daysFromNow(0), duree_minutes: 30, type: 'RDV commercial', statut: 'Réalisé' });
      }
      await sr.entities.rdv.bulkCreate(rdvs);
      await sleep(250);

      // Ventes : tous types machine, mix validées / à valider, quelques reprises
      const ventes = [];
      for (let i = 0; i < 16; i++) {
        const c = clients[i % clients.length];
        const cid = c.commerciaux_assignes?.[0] || null;
        const reprise = rnd(REPRISES);
        ventes.push({
          client_id: c.id, commercial_id: cid, base_responsable_id: c.base_responsable_id,
          date_vente: dateOnly(daysFromNow(-rndInt(0, 20))), type_machine: MACHINES[i % MACHINES.length],
          type_vente: rnd(TYPES_VENTE), reprise,
          marque_reprise: reprise === 'Reprise autre marque' ? rnd(MARQUES.filter((m) => m !== 'New Holland')) : null,
          source_declaration: Math.random() > 0.5 ? 'Import WhatsApp' : 'Saisie manuelle',
          statut_validation: i % 4 === 0 ? 'À valider' : 'Validé'
        });
      }
      await sr.entities.vente.bulkCreate(ventes);
      await sleep(250);

      // Offres magasin
      await sr.entities.offre_magasin.bulkCreate([
        { titre: PREFIX + 'Filtres & lubrifiants -20%', date_debut: '2026-10-13', date_fin: '2026-10-30', ca_realise: rndInt(20000, 60000) },
        { titre: PREFIX + 'Pièces d\'usure hivernage', date_debut: '2026-10-05', date_fin: '2026-10-25', ca_realise: rndInt(15000, 50000) }
      ]);
      await sleep(200);

      // Badges attribués (création directe, idempotente, légère)
      let badgesAttribues = 0;
      if (badges.length && commercials.length) {
        const existing = await listAll('badge_obtenu', sr);
        const seen = new Set(existing.map((o) => `${o.utilisateur_id}|${o.badge_id}`));
        const bo = [];
        commercials.slice(0, 6).forEach((comm, idx) => {
          badges.slice(0, (idx % 3) + 1).forEach((b) => {
            const key = `${comm.id}|${b.id}`;
            if (!seen.has(key)) { bo.push({ utilisateur_id: comm.id, badge_id: b.id }); seen.add(key); }
          });
        });
        if (bo.length) { await sr.entities.badge_obtenu.bulkCreate(bo); badgesAttribues = bo.length; }
      }

      return Response.json({
        ok: true, clients: clients.length, materiels: materiels.length, rdv: rdvs.length,
        ventes: ventes.length, offres: 2, commerciaux_utilises: commercials.length, badges_attribues: badgesAttribues,
        note: commercials.length === 0 ? "Aucun compte commercial : ventes/RDV créés sans attribution. Créez d'abord les comptes (Structure) pour les vues par commercial." : undefined
      });
    }

    return Response.json({ error: 'action inconnue' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: `[generer_donnees_demo] ${error?.message || String(error)}` }, { status: 500 });
  }
}
