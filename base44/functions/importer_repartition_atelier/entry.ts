import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { norm, cleSite, entiteDe, zoneDe, apparierSite } from '../../shared/atelier.ts';

// Répartition des CHEFS D'ATELIER par secteur commercial (fichier « LISTE COMMERCIAUX et
// CHEF AT (Par chef d'atelier) ») : met à jour les sites (bases) avec leurs chefs d'atelier,
// responsables SAV, zone, entité et commerciaux rattachés.
// Aucune donnée en place n'est effacée : les listes sont fusionnées et un site inconnu est créé.
// body = { file_url }

const propre = (v) => {
  const s = String(v ?? '').replace(/\u00a0/g, ' ').trim();
  return s || null;
};

const union = (a, b) => [...new Set([...(a || []).filter(Boolean), ...(b || []).filter(Boolean)])];

// Les fichiers ne sont pas toujours en UTF-8 (Excel exporte souvent en ANSI) : on décode en
// UTF-8, et on retombe sur l'encodage Windows quand le texte sort abîmé — sinon les accents
// cassent les rapprochements de sites (« Béthines » ne se retrouvait plus).
async function texteFichier(rep) {
  const octets = new Uint8Array(await rep.arrayBuffer());
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch (e) {
    return new TextDecoder('windows-1252').decode(octets);
  }
}

// Découpage CSV tolérant : séparateur « ; » ou « , », guillemets gérés.
function lignesCsv(texte) {
  const brut = String(texte || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (brut.length === 0) return [];
  const entete = brut[0];
  const sep = (entete.split(';').length >= entete.split(',').length) ? ';' : ',';
  return brut.map((l) => {
    const cells = [];
    let courant = '';
    let guillemets = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') {
        if (guillemets && l[i + 1] === '"') { courant += '"'; i += 1; } else guillemets = !guillemets;
      } else if (ch === sep && !guillemets) {
        cells.push(courant);
        courant = '';
      } else courant += ch;
    }
    cells.push(courant);
    return cells.map((c) => c.trim());
  });
}

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

    const rep = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!rep.ok) return Response.json({ error: `Fichier illisible (${rep.status}).` }, { status: 400 });
    const lignes = lignesCsv(await texteFichier(rep));
    if (lignes.length < 2) return Response.json({ error: 'Fichier vide ou illisible.' }, { status: 400 });

    const entete = lignes[0].map(norm);
    const col = (motif) => entete.findIndex((h) => h.includes(motif));
    const iComm = col('COMMERCIAL');
    const iAtelier = col('ATELIER');
    if (iComm < 0 || iAtelier < 0) {
      return Response.json({ error: 'Colonnes « COMMERCIAL » et « Atelier » introuvables dans le fichier.' }, { status: 400 });
    }
    const iZone = col('ZONE');
    const iConc = col('CONCESSION');
    const iChef = col('CHEF');
    const iSav = col('SAV');

    // Un site = ses commerciaux, son chef d'atelier, son responsable SAV, sa zone et son entité.
    const parSite = new Map();
    for (let i = 1; i < lignes.length; i++) {
      const l = lignes[i];
      const atelier = iAtelier >= 0 ? propre(l[iAtelier]) : null;
      if (!atelier) continue;
      const cle = cleSite(atelier);
      const s = parSite.get(cle) || { nom: atelier, zone: null, concession: null, commerciaux: new Set(), chefs: new Set(), sav: new Set() };
      if (iZone >= 0) s.zone = zoneDe(l[iZone]) || s.zone;
      if (iConc >= 0) s.concession = propre(l[iConc]) || s.concession;
      const comm = propre(l[iComm]);
      if (comm) s.commerciaux.add(comm);
      const chef = iChef >= 0 ? propre(l[iChef]) : null;
      if (chef) s.chefs.add(chef);
      const sav = iSav >= 0 ? propre(l[iSav]) : null;
      if (sav) s.sav.add(sav);
      parSite.set(cle, s);
    }

    const existants = await sr.entities.base.list('nom', 500).catch(() => []);
    const rapport = [];

    for (const s of parSite.values()) {
      const chefs = [...s.chefs];
      const sav = [...s.sav];
      const commerciaux = [...s.commerciaux];
      const cible = apparierSite(s.nom, chefs[0], existants);
      const zone = s.zone || cible?.zone || null;
      const entite = entiteDe(s.concession || cible?.entite || '');

      if (!cible) {
        const cree = await sr.entities.base.create({ nom: s.nom, zone, entite, chefs_atelier: chefs, responsables_sav: sav, commerciaux });
        existants.push(cree);
        rapport.push({ site: s.nom, cree: true, chefs, sav, commerciaux: commerciaux.length });
        continue;
      }
      const maj = {
        chefs_atelier: union(cible.chefs_atelier, chefs),
        responsables_sav: union(cible.responsables_sav, sav),
        commerciaux: union(cible.commerciaux, commerciaux),
        zone,
        entite
      };
      await sr.entities.base.update(cible.id, maj);
      rapport.push({ site: cible.nom, cree: false, chefs: maj.chefs_atelier, sav: maj.responsables_sav, commerciaux: maj.commerciaux.length });
    }

    return Response.json({ ok: true, lignes: lignes.length - 1, sites: rapport });
  } catch (error) {
    return Response.json({ error: `[importer_repartition_atelier] ${error?.message || String(error)}` }, { status: 500 });
  }
}