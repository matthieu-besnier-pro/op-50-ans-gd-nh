import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Création / MISE À JOUR en masse (clients et matériel) pour l'import des bases par secteur.
// L'import peut être relancé sans créer de doublons :
//   - une fiche client déjà présente (même SIREN) est complétée, jamais dupliquée ;
//   - une machine déjà présente chez le client (même VIN ou même plaque) est ignorée ;
//   - le parc du client (total + répartition par catégorie) est recalculé depuis la base
//     après l'ajout des machines, pour que l'affichage reste juste en ré-import.
// body = { entity: 'client' | 'materiel', records: [...] (max ~400) }
// Pour 'client', renvoie le mapping siren -> id (pour rattacher le matériel).

const CHUNK = 500;

const enLots = (list, taille) => {
  const lots = [];
  for (let i = 0; i < list.length; i += taille) lots.push(list.slice(i, i + taille));
  return lots;
};

// Lecture paginée complète (au-delà de la limite de 500 par appel).
async function lireTout(fetchPage) {
  const out = [];
  for (let i = 0; i < 20; i++) {
    const page = await fetchPage(i * CHUNK);
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < CHUNK) break;
  }
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }
    const sr = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const entity = body.entity === 'materiel' ? 'materiel' : 'client';
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) return Response.json({ ok: true, crees: 0, reutilises: 0, ignores: 0, map: {} });

    // ---------- Clients : on réutilise la fiche existante (même SIREN) ----------
    if (entity === 'client') {
      const sirens = [...new Set(records.map((r) => String(r.siren || '')).filter(Boolean))];
      const existants = {};
      for (const lot of enLots(sirens, 80)) {
        const trouve = await sr.entities.client.filter({ siren: { $in: lot } }).catch(() => []);
        (trouve || []).forEach((c) => { if (c.siren && !existants[c.siren]) existants[c.siren] = c; });
      }

      const aCreer = [];
      const aCompleter = [];
      const map = {};
      for (const r of records) {
        const cle = String(r.siren || '');
        const ex = cle ? existants[cle] : null;
        if (!ex) { aCreer.push(r); continue; }
        map[cle] = ex.id;
        // On complète la fiche sans écraser le travail de terrain (statut, RDV, commentaires…).
        const champs = {};
        const usages = [...new Set([...(ex.usages || []), ...(r.usages || [])])];
        if (usages.length !== (ex.usages || []).length) champs.usages = usages;
        ['secteur', 'adresse_complete', 'tel_mobile', 'tel_fixe', 'code_commune', 'departement'].forEach((k) => {
          if (!ex[k] && r[k]) champs[k] = r[k];
        });
        if (r.priorite_commercial && !ex.priorite_commercial) champs.priorite_commercial = true;
        if (Object.keys(champs).length > 0) aCompleter.push({ id: ex.id, ...champs });
      }

      const crees = aCreer.length > 0 ? await sr.entities.client.bulkCreate(aCreer) : [];
      (crees || []).forEach((c) => { if (c.siren) map[String(c.siren)] = c.id; });
      for (const lot of enLots(aCompleter, 300)) await sr.entities.client.bulkUpdate(lot);

      return Response.json({
        ok: true,
        crees: (crees || []).length,
        reutilises: records.length - aCreer.length,
        ignores: 0,
        map
      });
    }

    // ---------- Matériel : pas de doublon (même VIN ou même plaque chez le client) ----------
    const idsClients = [...new Set(records.map((r) => String(r.client_id || '')).filter(Boolean))];
    const connues = new Set();
    for (const lot of enLots(idsClients, 60)) {
      const mats = await lireTout((skip) => sr.entities.materiel.filter({ client_id: { $in: lot } }, 'id', CHUNK, skip).catch(() => []));
      mats.forEach((m) => {
        [m.vin, m.num_plaque].forEach((v) => { if (v) connues.add(`${m.client_id}|${String(v).toUpperCase()}`); });
      });
    }
    const aCreer = records.filter((r) => {
      const cles = [r.vin, r.num_plaque].filter(Boolean).map((v) => `${r.client_id}|${String(v).toUpperCase()}`);
      return !cles.some((k) => connues.has(k));
    });

    const crees = aCreer.length > 0 ? await sr.entities.materiel.bulkCreate(aCreer) : [];

    // Parc recalculé depuis la base pour les clients concernés : le bandeau pictogrammes
    // et le total restent justes, même si les machines arrivent en plusieurs imports.
    const touches = [...new Set(crees.map((m) => m.client_id).filter(Boolean))];
    for (const lot of enLots(touches, 50)) {
      const mats = await lireTout((skip) => sr.entities.materiel.filter({ client_id: { $in: lot } }, 'id', CHUNK, skip).catch(() => []));
      const parClient = {};
      mats.forEach((m) => {
        if (!m.client_id) return;
        const p = parClient[m.client_id] || (parClient[m.client_id] = { total: 0, cats: {} });
        p.total += 1;
        const cat = m.categorie_op || 'AUTRES';
        p.cats[cat] = (p.cats[cat] || 0) + 1;
      });
      const maj = Object.entries(parClient).map(([id, p]) => ({
        id,
        parc_total: p.total,
        parc_pictos: Object.entries(p.cats).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`)
      }));
      for (const lotMaj of enLots(maj, 300)) await sr.entities.client.bulkUpdate(lotMaj);
    }

    return Response.json({ ok: true, crees: crees.length, reutilises: 0, ignores: records.length - crees.length, map: {} });
  } catch (error) {
    return Response.json({ error: `[creer_clients_lot] ${error?.message || String(error)}` }, { status: 500 });
  }
}