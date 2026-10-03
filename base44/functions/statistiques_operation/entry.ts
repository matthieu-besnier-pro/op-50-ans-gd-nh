import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Comptages EXACTS de l'opération, calculés côté serveur en parcourant l'intégralité
// des données : les pages n'affichent plus de totaux issus de listes tronquées
// (1000 clients, 500 matériels, 500 ventes…).
// Portée : Direction/Marketing = toute l'opération, Responsable = son équipe,
// Commercial / Agri. précision = son portefeuille.
// La portée « démo » (voir en tant que) n'est acceptée que pour la Direction.

const CHUNK = 5000;
const MAX_PAGES = 20;

async function lireTout(fetchPage) {
  const out = [];
  const vus = new Set();
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchPage(i * CHUNK);
    if (!Array.isArray(page) || page.length === 0) break;
    let nouveaux = 0;
    page.forEach((r) => { if (!vus.has(r.id)) { vus.add(r.id); out.push(r); nouveaux += 1; } });
    if (page.length < CHUNK || nouveaux === 0) break;
  }
  return out;
}

const debutDuMois = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const estDirection = user.role === 'admin' || user.app_role === 'direction';
    const role = user.app_role || 'collaborateur';

    let portee = 'operation';
    let gardeClients = () => true;
    let gardeActivite = () => true;

    if (!estDirection && role === 'responsable') {
      portee = 'equipe';
      gardeClients = (c) => c.base_responsable_id === user.id;
      gardeActivite = (r) => r.base_responsable_id === user.id;
    } else if (!estDirection && (role === 'commercial' || role === 'agri_precision')) {
      portee = 'portefeuille';
      gardeClients = (c) => (c.commerciaux_assignes || []).includes(user.id);
      gardeActivite = (r) => r.commercial_id === user.id;
    } else if (estDirection && body?.scope) {
      const ids = body.scope.commercial_ids || [];
      const secteurs = (body.scope.secteurs || []).map((s) => String(s).trim().toLowerCase());
      if (ids.length > 0 || secteurs.length > 0) {
        portee = 'demo';
        gardeClients = (c) =>
          (c.commerciaux_assignes || []).some((i) => ids.includes(i)) ||
          secteurs.includes(String(c.secteur || '').trim().toLowerCase());
        gardeActivite = (r) => ids.includes(r.commercial_id);
      }
    }

    // Tri par identifiant : clé unique, donc pagination sans doublon ni oubli.
    const [allClients, allRdvs, allVentes, offres, badges, obtenus, paramsListe, structure] = await Promise.all([
      lireTout((skip) => sr.entities.client.list('id', CHUNK, skip)),
      lireTout((skip) => sr.entities.rdv.list('id', CHUNK, skip)),
      lireTout((skip) => sr.entities.vente.list('id', CHUNK, skip)),
      sr.entities.offre_magasin.list('-date_debut', 500).catch(() => []),
      sr.entities.badge.list('-created_date', 200).catch(() => []),
      sr.entities.badge_obtenu.list('-created_date', 1000).catch(() => []),
      sr.entities.parametres_operation.list('-created_date', 1).catch(() => []),
      sr.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => [])
    ]);
    const params = paramsListe[0] || null;

    const clients = allClients.filter(gardeClients);
    const rdvs = allRdvs.filter(gardeActivite);
    const ventes = allVentes.filter(gardeActivite);

    const parStatut = {};
    const parAppetence = {};
    const parCommercial = {};
    const parSecteur = {};
    const parCategorie = {};
    let parcTotal = 0;

    clients.forEach((c) => {
      const st = c.statut || '(non renseigné)';
      parStatut[st] = (parStatut[st] || 0) + 1;
      const ap = c.niveau_appetence || 'Non évalué';
      parAppetence[ap] = (parAppetence[ap] || 0) + 1;

      (c.commerciaux_assignes || []).forEach((id) => {
        const e = (parCommercial[id] = parCommercial[id] || { total: 0, par_statut: {} });
        e.total += 1;
        e.par_statut[st] = (e.par_statut[st] || 0) + 1;
      });

      const secteur = String(c.secteur || '').trim();
      if (secteur && secteur !== 'Commune non trouvée') {
        const e = (parSecteur[secteur] = parSecteur[secteur] || { total: 0, par_statut: {} });
        e.total += 1;
        e.par_statut[st] = (e.par_statut[st] || 0) + 1;
      }

      (c.parc_pictos || []).forEach((p) => {
        const [cat, n] = String(p).split(':');
        const v = Number(n) || 0;
        if (!cat || v <= 0) return;
        parCategorie[cat] = (parCategorie[cat] || 0) + v;
        parcTotal += v;
      });
    });

    const moisDebut = debutDuMois();
    const sprintDebut = params?.date_debut_prise_rdv || null;
    const sprintFin = params?.date_fin_prise_rdv || null;
    const rdvParStatut = {};
    const rdvParType = {};
    const rdvParCommercial = {};
    const rdvSprintParCommercial = {};
    let rdvMois = 0;
    let rdvRealisesMois = 0;
    let rdvAtelierMois = 0;
    let rdvCommercialMois = 0;
    let rdvAtelierRealisesMois = 0;
    let rdvCommercialRealisesMois = 0;
    let rdvAtelierHorsAnnuleMois = 0;
    let sprintTotal = 0;
    let sprintAtelier = 0;
    let sprintCommercial = 0;
    let sprintRealises = 0;

    rdvs.forEach((r) => {
      const st = r.statut || '(non renseigné)';
      rdvParStatut[st] = (rdvParStatut[st] || 0) + 1;
      const ty = r.type || '(non renseigné)';
      rdvParType[ty] = (rdvParType[ty] || 0) + 1;
      const atelier = ty === 'RDV atelier hivernage';

      const duMois = Boolean(r.date_heure) && r.date_heure >= moisDebut;
      const realise = st === 'Réalisé';
      if (duMois) {
        rdvMois += 1;
        if (atelier) {
          rdvAtelierMois += 1;
          if (st !== 'Annulé') rdvAtelierHorsAnnuleMois += 1;
          if (realise) rdvAtelierRealisesMois += 1;
        } else {
          rdvCommercialMois += 1;
          if (realise) rdvCommercialRealisesMois += 1;
        }
        if (realise) rdvRealisesMois += 1;
      }

      const jour = (r.date_heure || '').slice(0, 10);
      if (sprintDebut && sprintFin && jour >= sprintDebut && jour <= sprintFin) {
        sprintTotal += 1;
        if (atelier) sprintAtelier += 1; else sprintCommercial += 1;
        if (realise) sprintRealises += 1;
        if (r.commercial_id) rdvSprintParCommercial[r.commercial_id] = (rdvSprintParCommercial[r.commercial_id] || 0) + 1;
      }

      if (r.commercial_id) {
        const e = (rdvParCommercial[r.commercial_id] = rdvParCommercial[r.commercial_id] || { total: 0, realises_mois: 0, du_mois: 0 });
        e.total += 1;
        if (duMois) e.du_mois += 1;
        if (duMois && realise) e.realises_mois += 1;
      }
    });

    const ventesParMachine = {};
    const ventesParTypeVente = {};
    const ventesParReprise = {};
    const ventesParCommercial = {};
    let ventesValidees = 0;

    ventes.forEach((v) => {
      if (v.statut_validation !== 'Validé') return;
      ventesValidees += 1;
      const tm = v.type_machine || 'Autre';
      ventesParMachine[tm] = (ventesParMachine[tm] || 0) + 1;
      const tv = v.type_vente || 'Autre';
      ventesParTypeVente[tv] = (ventesParTypeVente[tv] || 0) + 1;
      const rp = v.reprise || 'Sans reprise';
      ventesParReprise[rp] = (ventesParReprise[rp] || 0) + 1;
      if (v.commercial_id) ventesParCommercial[v.commercial_id] = (ventesParCommercial[v.commercial_id] || 0) + 1;
    });

    return Response.json({
      portee,
      maj: new Date().toISOString(),
      clients: {
        total: clients.length,
        par_statut: parStatut,
        par_appetence: parAppetence,
        par_commercial: parCommercial,
        par_secteur: parSecteur
      },
      parc: { total: parcTotal, par_categorie: parCategorie },
      rdv: {
        total: rdvs.length,
        par_statut: rdvParStatut,
        par_type: rdvParType,
        par_commercial: rdvParCommercial,
        sprint_par_commercial: rdvSprintParCommercial,
        du_mois: rdvMois,
        realises_du_mois: rdvRealisesMois,
        atelier_du_mois: rdvAtelierMois,
        atelier_realises_du_mois: rdvAtelierRealisesMois,
        atelier_hors_annule_du_mois: rdvAtelierHorsAnnuleMois,
        commercial_du_mois: rdvCommercialMois,
        commercial_realises_du_mois: rdvCommercialRealisesMois,
        sprint: { debut: sprintDebut, fin: sprintFin, total: sprintTotal, atelier: sprintAtelier, commercial: sprintCommercial, realises: sprintRealises }
      },
      ventes: {
        total: ventes.length,
        validees: ventesValidees,
        par_commercial: ventesParCommercial,
        par_type_machine: ventesParMachine,
        par_type_vente: ventesParTypeVente,
        par_reprise: ventesParReprise
      },
      offres: { total: offres.length, ca_realise: offres.reduce((s, o) => s + (o.ca_realise || 0), 0) },
      badges: { total: badges.length, obtenus: obtenus.length },
      structure: { commerciaux: structure.length }
    });
  } catch (error) {
    return Response.json({ error: `[statistiques_operation] ${error?.message || String(error)}` }, { status: 500 });
  }
}