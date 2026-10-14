import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import * as XLSX from 'npm:xlsx@0.18.5';
import { norm, cleNom, offreSav, categorieOp, apparierSite, comptesDesChefs } from '../../shared/atelier.ts';

// Fichier consolidé des cibles atelier de l'opération 50 ans (une ligne = un client × une machine,
// avec son OP : inspection annuelle, révision, contrat de service).
//   - un client déjà présent (même machine, même N° client Mistral ou même nom) est complété ;
//   - sinon une fiche est créée ;
//   - les clients ainsi ciblés ne sont visibles que par les chefs d'atelier de leur site, et par
//     le commercial lorsqu'ils sont déjà dans son portefeuille.
// L'import peut être relancé : rien n'est dupliqué et aucune donnée existante n'est effacée.
// body = { file_url }

const CHUNK = 500;
const propre = (v) => {
  const s = String(v ?? '').replace(/\u00a0/g, ' ').trim();
  return s || null;
};
const union = (a, b) => [...new Set([...(a || []).filter(Boolean), ...(b || []).filter(Boolean)])];
const enLots = (liste, taille) => {
  const lots = [];
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille));
  return lots;
};

async function lireTout(fetchPage, max = 30000) {
  const out = [];
  for (let i = 0; i < 40 && out.length < max; i += 1) {
    const page = await fetchPage(i * CHUNK);
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < CHUNK) break;
  }
  return out;
}

// Comptage du parc par catégorie d'opération à partir d'un tableau « CAT:3 ».
const pictosDepuis = (liste, ajouts) => {
  const comptes = new Map();
  (liste || []).forEach((p) => {
    const [cat, n] = String(p).split(':');
    if (cat) comptes.set(cat, (comptes.get(cat) || 0) + (Number(n) || 0));
  });
  ajouts.forEach((cat) => comptes.set(cat, (comptes.get(cat) || 0) + 1));
  return [...comptes.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`);
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }
    const sr = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const url = propre(body.file_url);
    if (!url) return Response.json({ error: 'Fichier manquant.' }, { status: 400 });

    const rep = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!rep.ok) return Response.json({ error: `Fichier illisible (${rep.status}).` }, { status: 400 });
    const classeur = XLSX.read(new Uint8Array(await rep.arrayBuffer()), { type: 'array' });
    const feuille = classeur.SheetNames.find((n) => norm(n).includes('RECAP')) || classeur.SheetNames[0];
    const lignes = XLSX.utils.sheet_to_json(classeur.Sheets[feuille], { header: 1, defval: '' });

    let h = -1;
    for (let i = 0; i < Math.min(lignes.length, 10); i += 1) {
      const r = lignes[i].map(norm);
      if (r.some((c) => c === 'CLIENT') && r.some((c) => c.startsWith('AGENCE'))) { h = i; break; }
    }
    if (h < 0) return Response.json({ error: 'Entête introuvable (colonnes « Agence » et « Client » attendues).' }, { status: 400 });

    const entete = lignes[h].map(norm);
    const idx = (...cles) => {
      for (const k of cles) { const i = entete.indexOf(k); if (i >= 0) return i; }
      for (const k of cles) { const i = entete.findIndex((c) => c.includes(k)); if (i >= 0) return i; }
      return -1;
    };
    const cAgence = idx('AGENCE');
    const cChef = idx('CHEF');
    const cClient = idx('CLIENT');
    const cMistral = idx('MISTRAL');
    const cMarque = idx('MARQUE');
    const cModele = idx('MODELE');
    const cType = idx('TYPE');
    const cVin = idx('VIN');
    const cOp = idx('OP');
    const cMat = idx('N MAT');
    if (cClient < 0 || cAgence < 0 || cOp < 0) {
      return Response.json({ error: 'Colonnes « Agence », « Client » ou « OP » introuvables dans le fichier.' }, { status: 400 });
    }

    const [bases, users] = await Promise.all([
      sr.entities.base.list('nom', 500).catch(() => []),
      sr.entities.User.list('-created_date', 500).catch(() => [])
    ]);
    const existants = await lireTout((skip) => sr.entities.client.filter({}, 'id', CHUNK, skip));

    const parCle = new Map();
    const parNom = new Map();
    const parCode = new Map();
    existants.forEach((c) => {
      if (!c.raison_sociale) return;
      const k = cleNom(c.raison_sociale);
      if (k && !parCle.has(k)) parCle.set(k, c);
      const n = norm(c.raison_sociale);
      if (n && !parNom.has(n)) parNom.set(n, c);
      if (c.code_client && !parCode.has(String(c.code_client))) parCode.set(String(c.code_client), c);
    });

    // Machines déjà connues : rapprochement par VIN puis par numéro de matériel.
    const vins = [];
    const mats = [];
    lignes.slice(h + 1).forEach((l) => {
      const v = propre(cVin >= 0 ? l[cVin] : null);
      if (v) vins.push(v.toUpperCase());
      const m = propre(cMat >= 0 ? l[cMat] : null);
      if (m) mats.push(m.toUpperCase());
    });
    const machineConnue = new Map();
    for (const lot of enLots([...new Set(vins)], 150)) {
      const trouve = await sr.entities.materiel.filter({ vin: { $in: lot } }, 'id', CHUNK).catch(() => []);
      (trouve || []).forEach((m) => { if (m.vin) machineConnue.set(String(m.vin).toUpperCase(), m); });
    }
    for (const lot of enLots([...new Set(mats)], 150)) {
      const trouve = await sr.entities.materiel.filter({ id_vehicule: { $in: lot } }, 'id', CHUNK).catch(() => []);
      (trouve || []).forEach((m) => { if (m.id_vehicule) machineConnue.set(`MAT:${String(m.id_vehicule).toUpperCase()}`, m); });
    }

    // Regroupement des lignes par client (fiche existante ou nouvelle fiche à créer).
    const parClient = new Map();
    const sitesInconnus = new Set();
    const chefsInconnus = new Set();
    let lignesSansClient = 0;

    lignes.slice(h + 1).forEach((l) => {
      const nom = propre(l[cClient]);
      const op = offreSav(propre(l[cOp]));
      if (!nom && !op) return;
      const agence = propre(l[cAgence]);
      const chefFichier = cChef >= 0 ? propre(l[cChef]) : null;
      const vin = propre(cVin >= 0 ? l[cVin] : null);
      const mat = propre(cMat >= 0 ? l[cMat] : null);
      const code = propre(cMistral >= 0 ? l[cMistral] : null);

      const site = apparierSite(agence, chefFichier, bases);
      if (agence && !site) sitesInconnus.add(agence);
      const chefsSite = (site?.chefs_atelier || []).filter(Boolean);
      const nomsChefs = chefsSite.length > 0 ? chefsSite : (chefFichier ? [chefFichier] : []);
      const { ids: chefsIds, inconnus } = comptesDesChefs(nomsChefs, users);
      inconnus.forEach((n) => chefsInconnus.add(n));

      const machine = (vin && machineConnue.get(vin.toUpperCase())) || (mat && machineConnue.get(`MAT:${mat.toUpperCase()}`)) || null;
      const existant = (machine && existants.find((c) => c.id === machine.client_id))
        || (code && parCode.get(String(code)))
        || (nom && (parCle.get(cleNom(nom)) || parNom.get(norm(nom))))
        || null;

      const cleClient = existant ? `id:${existant.id}` : (nom ? `nom:${cleNom(nom)}` : null);
      if (!cleClient) { lignesSansClient += 1; return; }

      const entree = parClient.get(cleClient) || {
        existant: existant || null,
        raison_sociale: nom || existant?.raison_sociale || 'Client',
        code_client: code || existant?.code_client || null,
        site: site?.nom || agence || null,
        chefs: new Set(),
        chefsIds: new Set(),
        offres: new Set(),
        machines: []
      };
      nomsChefs.forEach((n) => entree.chefs.add(n));
      chefsIds.forEach((i) => entree.chefsIds.add(i));
      if (op) entree.offres.add(op);
      if (!machine) {
        entree.machines.push({
          marque: propre(cMarque >= 0 ? l[cMarque] : null),
          modele: propre(cModele >= 0 ? l[cModele] : null),
          categorie_1: propre(cType >= 0 ? l[cType] : null),
          categorie_op: categorieOp(propre(cType >= 0 ? l[cType] : null)),
          vin,
          id_vehicule: mat,
          offre_sav: op,
          usage: 'atelier',
          occasion_neuf: 'Inconnu'
        });
      }
      parClient.set(cleClient, entree);
    });

    // 1) Fiches manquantes puis 2) champs SAV des fiches existantes.
    let clientsCrees = 0;
    let clientsCompletes = 0;
    let machinesCreees = 0;
    const aCompleter = [];
    const aCompleterMachines = [];
    const idParCle = new Map();

    for (const [cle, e] of parClient.entries()) {
      const offres = [...e.offres];
      if (!e.existant) {
        const cree = await sr.entities.client.create({
          raison_sociale: e.raison_sociale,
          code_client: e.code_client,
          statut: 'À contacter',
          nb_tentatives_contact: 0,
          usages: ['atelier'],
          cible_atelier: true,
          site_atelier: e.site,
          chefs_atelier: [...e.chefs],
          chefs_atelier_ids: [...e.chefsIds],
          offres_sav: offres,
          parc_total: e.machines.length,
          parc_pictos: pictosDepuis([], e.machines.map((m) => m.categorie_op))
        });
        idParCle.set(cle, cree.id);
        clientsCrees += 1;
      } else {
        idParCle.set(cle, e.existant.id);
        aCompleter.push({
          id: e.existant.id,
          cible_atelier: true,
          site_atelier: e.site || e.existant.site_atelier || null,
          chefs_atelier: union(e.existant.chefs_atelier, [...e.chefs]),
          chefs_atelier_ids: union(e.existant.chefs_atelier_ids, [...e.chefsIds]),
          offres_sav: union(e.existant.offres_sav, offres),
          usages: union(e.existant.usages, ['atelier']),
          parc_total: (e.existant.parc_total || 0) + e.machines.length,
          parc_pictos: e.machines.length > 0 ? pictosDepuis(e.existant.parc_pictos, e.machines.map((m) => m.categorie_op)) : e.existant.parc_pictos
        });
        clientsCompletes += 1;
      }
      e.machines.forEach((m) => {
        aCompleterMachines.push(m);
        machinesCreees += 1;
      });
    }

    if (aCompleter.length > 0) {
      for (const lot of enLots(aCompleter, 200)) await sr.entities.client.bulkUpdate(lot);
    }

    // Les machines déjà connues de la base reçoivent seulement leur offre SAV.
    const majMachines = [];
    lignes.slice(h + 1).forEach((l) => {
      const op = offreSav(propre(l[cOp]));
      const vin = propre(cVin >= 0 ? l[cVin] : null);
      const mat = propre(cMat >= 0 ? l[cMat] : null);
      const machine = (vin && machineConnue.get(vin.toUpperCase())) || (mat && machineConnue.get(`MAT:${mat.toUpperCase()}`)) || null;
      if (machine && op && machine.offre_sav !== op) majMachines.push({ id: machine.id, offre_sav: op });
    });
    const majUnique = [...new Map(majMachines.map((m) => [m.id, m])).values()];
    if (majUnique.length > 0) {
      for (const lot of enLots(majUnique, 200)) await sr.entities.materiel.bulkUpdate(lot);
    }

    const parClientId = new Map();
    for (const [cle, e] of parClient.entries()) {
      const id = idParCle.get(cle);
      const liste = parClientId.get(id) || [];
      liste.push(...e.machines);
      parClientId.set(id, liste);
    }
    const fiches = await lireTout((skip) => sr.entities.client.filter({}, 'id', CHUNK, skip));
    const parFiche = new Map(fiches.map((c) => [c.id, c]));

    const toutesMachines = [];
    for (const [id, liste] of parClientId.entries()) {
      const fiche = parFiche.get(id);
      if (!fiche) continue;
      liste.forEach((m) => {
        toutesMachines.push({
          ...m,
          client_id: id,
          commerciaux_assignes: fiche.commerciaux_assignes || [],
          base_responsable_id: fiche.base_responsable_id || null,
          secteur: fiche.secteur || null
        });
      });
    }
    for (const lot of enLots(toutesMachines, 200)) await sr.entities.materiel.bulkCreate(lot);

    return Response.json({
      ok: true,
      lignes: lignes.length - h - 1,
      clients: parClient.size,
      clientsCrees,
      clientsCompletes,
      machinesCreees: toutesMachines.length,
      machinesMaj: majUnique.length,
      sitesInconnus: [...sitesInconnus],
      chefsInconnus: [...chefsInconnus],
      lignesIgnorees: lignesSansClient
    });
  } catch (error) {
    return Response.json({ error: `[importer_cible_atelier] ${error?.message || String(error)}` }, { status: 500 });
  }
}