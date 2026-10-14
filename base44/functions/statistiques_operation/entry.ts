import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { perimetreAtelier, perimetreResponsable, perimetreCommercial, estDansPerimetre, filtreClientsPerimetre } from '../../shared/perimetre.ts';
import { STATUT_CONTACT_ATELIER_REFUS, rdvAtelierObtenu, routageRdv } from '../../shared/atelier.ts';

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
    // Mêmes sélections, mais confiées au SERVEUR. Sans elles, chaque compte
    // rapatriait l'intégralité des clients, des rendez-vous et des ventes avant
    // d'en jeter 95 % en mémoire : d'où une attente de plusieurs secondes sur
    // chaque tableau de bord, et une pression inutile sur la limite de débit.
    // Les prédicats ci-dessus restent appliqués ensuite : le résultat est
    // identique, seul le volume transporté change.
    let filtreClients = null;
    let filtreActivite = null;

    if (!estDirection && role === 'responsable') {
      portee = 'equipe';
      // Même règle que la liste : son équipe vient de la structure commerciale,
      // pas d'un champ porté par le client.
      const equipe = await perimetreResponsable(sr, user);
      if (equipe && (equipe.ids.length > 0 || equipe.secteurs.length > 0)) {
        const dansEquipe = estDansPerimetre(equipe);
        const idsEquipe = new Set(equipe.ids);
        gardeClients = (c) => dansEquipe(c) || c.base_responsable_id === user.id;
        gardeActivite = (r) => idsEquipe.has(r.commercial_id) || r.base_responsable_id === user.id;
        filtreClients = { $or: [...filtreClientsPerimetre(equipe).$or, { base_responsable_id: user.id }] };
        filtreActivite = { $or: [{ commercial_id: { $in: equipe.ids } }, { base_responsable_id: user.id }] };
      } else {
        gardeClients = (c) => c.base_responsable_id === user.id;
        gardeActivite = (r) => r.base_responsable_id === user.id;
        filtreClients = { base_responsable_id: user.id };
        filtreActivite = { base_responsable_id: user.id };
      }
    } else if (!estDirection && (role === 'commercial' || role === 'agri_precision')) {
      portee = 'portefeuille';
      // Comme pour la liste : assignation OU secteur, sinon ses chiffres restent
      // à zéro tant que le rattachement automatique n'a pas tourné.
      const sien = await perimetreCommercial(sr, user);
      if (sien && sien.secteurs.length > 0) {
        const aMoi = estDansPerimetre(sien);
        gardeClients = (c) => aMoi(c);
        filtreClients = filtreClientsPerimetre(sien);
      } else {
        gardeClients = (c) => (c.commerciaux_assignes || []).includes(user.id);
        filtreClients = { commerciaux_assignes: { $in: [user.id] } };
      }
      gardeActivite = (r) => r.commercial_id === user.id;
      filtreActivite = { commercial_id: user.id };
    } else if (!estDirection && (role === 'chef_atelier' || role === 'responsable_sav' || role === 'commercial_chef_atelier')) {
      // Périmètre « atelier » : les clients des commerciaux des sites du référent.
      const perimetre = await perimetreAtelier(sr, user);
      if (perimetre) {
        portee = 'atelier';
        gardeClients = estDansPerimetre(perimetre);
        const ids = new Set(perimetre.ids);
        gardeActivite = (r) => ids.has(r.commercial_id);
        filtreClients = filtreClientsPerimetre(perimetre);
        filtreActivite = { commercial_id: { $in: perimetre.ids } };
      }
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
    // Lecture filtrée dès qu'un périmètre est posé ; la Direction, qui voit tout,
    // garde la lecture intégrale.
    const lecteur = (entite, filtre) => (skip) => (filtre
      ? sr.entities[entite].filter(filtre, 'id', CHUNK, skip)
      : sr.entities[entite].list('id', CHUNK, skip));

    const [allClients, allRdvs, allVentes, offres, badges, obtenus, paramsListe, structure, bases, users] = await Promise.all([
      lireTout(lecteur('client', filtreClients)),
      lireTout(lecteur('rdv', filtreActivite)),
      lireTout(lecteur('vente', filtreActivite)),
      sr.entities.offre_magasin.list('-date_debut', 500).catch(() => []),
      sr.entities.badge.list('-created_date', 200).catch(() => []),
      sr.entities.badge_obtenu.list('-created_date', 1000).catch(() => []),
      sr.entities.parametres_operation.list('-created_date', 1).catch(() => []),
      sr.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => []),
      sr.entities.base.list('nom', 200).catch(() => []),
      sr.entities.User.list('-created_date', 500).catch(() => [])
    ]);
    const params = paramsListe[0] || null;

    // Les rendez-vous d'atelier appartiennent au SAV : ils sont posés par les
    // chefs d'atelier, et n'ont rien à faire dans les chiffres du commerce. On
    // ne les écarte évidemment pas quand c'est un référent d'atelier qui
    // consulte ses propres chiffres.
    const idsDesFiches = new Set();
    allClients.forEach((c) => (c.chefs_atelier_ids || []).forEach((id) => id && idsDesFiches.add(id)));
    const { estAtelier, referents } = routageRdv(bases, users, [...idsDesFiches]);
    const gardeCommerce = portee === 'atelier' ? () => true : (r) => !estAtelier(r);

    const clients = allClients.filter(gardeClients);
    const rdvs = allRdvs.filter((r) => gardeActivite(r) && gardeCommerce(r));
    const ventes = allVentes.filter(gardeActivite);

    const parStatut = {};
    const parAppetence = {};
    const parCommercial = {};
    const parSecteur = {};
    const parCategorie = {};
    let parcTotal = 0;
    // Cibles prioritaires : les clients choisis par les commerciaux dans leur
    // fichier. C'est le premier objectif de l'opération, avant le reste du parc.
    let prioTotal = 0, prioAContacter = 0, prioRdv = 0, prioVente = 0;
    const prioParCommercial = {};

    // Partie SAV : les contacts pris par les ateliers, pour le Grand Écran.
    // Le marquage n'enregistre pas QUI l'a posé, seulement le client et son
    // site : le comptage se fait donc par atelier, ce qui est aussi la maille
    // demandée (« les contacts pris par les ateliers »).
    let atelierCibles = 0, atelierContactes = 0, atelierOk = 0, atelierRefus = 0;
    const atelierParSite = {};
    const atelierRecents = [];

    clients.forEach((c) => {
      const st = c.statut || '(non renseigné)';
      parStatut[st] = (parStatut[st] || 0) + 1;

      if (c.priorite_commercial) {
        prioTotal += 1;
        if (st === 'À contacter') prioAContacter += 1;
        if (st.startsWith('RDV ')) prioRdv += 1;
        if (st === 'Vente conclue') prioVente += 1;
        (c.commerciaux_assignes || []).forEach((id) => {
          const e = (prioParCommercial[id] = prioParCommercial[id] || { total: 0, traites: 0 });
          e.total += 1;
          if (st !== 'À contacter') e.traites += 1;
        });
      }
      if (c.cible_atelier) {
        atelierCibles += 1;
        const site = String(c.site_atelier || '').trim() || 'Sans site';
        const e = (atelierParSite[site] = atelierParSite[site] || { cibles: 0, contactes: 0, ok: 0, refus: 0 });
        e.cibles += 1;
        // Le suivi courant ET les suivis déjà obtenus : le statut n'en garde qu'un.
        const suivis = [st, ...(Array.isArray(c.rdv_obtenus) ? c.rdv_obtenus : [])];
        // Cumul : rendez-vous atelier pris dans l'agenda (avec créneau) et marque
        // « OK pour un RDV » posée par le référent : un client compté une fois.
        const ok = rdvAtelierObtenu(suivis);
        const refus = !ok && suivis.includes(STATUT_CONTACT_ATELIER_REFUS);
        if (ok || refus) {
          e.contactes += 1;
          atelierContactes += 1;
          if (ok) { e.ok += 1; atelierOk += 1; } else { e.refus += 1; atelierRefus += 1; }
          atelierRecents.push({
            id: c.id,
            nom: c.raison_sociale || '',
            site,
            refus,
            date: c.updated_date || c.date_dernier_contact || ''
          });
        }
      }

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
    // Période de l'opération : c'est elle qui fait foi pour les compteurs affichés.
    // Sans elle (paramètres non renseignés), on retombe sur le mois calendaire.
    const opDebut = params?.date_debut_operation || null;
    const opFin = params?.date_fin_operation || null;
    const dansOperation = (iso) => {
      if (!iso) return false;
      const j = String(iso).slice(0, 10);
      if (opDebut && j < opDebut) return false;
      if (opFin && j > opFin) return false;
      return true;
    };
    const sprintDebut = params?.date_debut_prise_rdv || null;
    const sprintFin = params?.date_fin_prise_rdv || null;
    const rdvParStatut = {};
    const rdvParType = {};
    const rdvParCommercial = {};
    const rdvSprintParCommercial = {};
    // Même comptage, rendez-vous atelier retirés : ils alimentent la moitié atelier
    // du Grand Écran, pas le classement commerce.
    const rdvSprintParCommercialCommerce = {};
    let rdvMois = 0;
    let rdvRealisesMois = 0;
    let rdvAtelierMois = 0;
    let rdvCommercialMois = 0;
    let rdvAtelierRealisesMois = 0;
    let rdvCommercialRealisesMois = 0;
    let rdvAtelierHorsAnnuleMois = 0;
    let rdvPrisMois = 0;
    let rdvAtelierPrisMois = 0;
    let rdvCommercialPrisMois = 0;
    let rdvAgriMois = 0;
    let rdvAgriPrisMois = 0;
    let rdvAgriRealisesMois = 0;
    let sprintTotal = 0;
    let sprintAtelier = 0;
    let sprintAgri = 0;
    let sprintCommercial = 0;
    let sprintRealises = 0;
    let rdvAnnules = 0;
    let rdvOpPris = 0, rdvOpRealises = 0, rdvOpCommercial = 0, rdvOpAtelier = 0, rdvOpAgri = 0;

    const jourAujourdhui = new Date().toISOString().slice(0, 10);
    rdvs.forEach((r) => {
      const st = r.statut || '(non renseigné)';
      rdvParStatut[st] = (rdvParStatut[st] || 0) + 1;
      // Un rendez-vous annulé est soustrait de TOUS les comptages : il n'alimente
      // ni les totaux, ni le mois, ni le sprint, ni le classement par commercial.
      // Seule la ligne « annulés » (et par_statut) en garde la trace.
      if (st === 'Annulé') { rdvAnnules += 1; return; }
      const pris = true;
      const ty = r.type || '(non renseigné)';
      rdvParType[ty] = (rdvParType[ty] || 0) + 1;
      const atelier = ty === 'RDV atelier hivernage';
      const agriPrecision = ty === 'RDV agri. précision';

      const duMois = Boolean(r.date_heure) && r.date_heure >= moisDebut;
      const realise = st === 'Réalisé';

      // Comptages sur la période de l'opération (les annulés sont déjà écartés).
      if (dansOperation(r.date_heure)) {
        rdvOpPris += 1;
        if (realise) rdvOpRealises += 1;
        if (atelier) rdvOpAtelier += 1;
        else if (agriPrecision) rdvOpAgri += 1;
        else rdvOpCommercial += 1;
      }
      if (duMois) {
        rdvMois += 1;
        if (pris) rdvPrisMois += 1;
        if (atelier) {
          rdvAtelierMois += 1;
          if (pris) {
            rdvAtelierHorsAnnuleMois += 1;
            rdvAtelierPrisMois += 1;
          }
          if (realise) rdvAtelierRealisesMois += 1;
        } else if (agriPrecision) {
          rdvAgriMois += 1;
          if (pris) rdvAgriPrisMois += 1;
          if (realise) rdvAgriRealisesMois += 1;
        } else {
          rdvCommercialMois += 1;
          if (pris) rdvCommercialPrisMois += 1;
          if (realise) rdvCommercialRealisesMois += 1;
        }
        if (realise) rdvRealisesMois += 1;
      }

      // Sprint = rendez-vous PRIS pendant la fenêtre, quelle que soit la date à
      // laquelle ils auront lieu (un RDV posé le 13 pour le 25 compte).
      const jourPrise = (r.created_date || r.date_heure || '').slice(0, 10);
      if (sprintDebut && sprintFin && jourPrise >= sprintDebut && jourPrise <= sprintFin) {
        sprintTotal += 1;
        if (atelier) sprintAtelier += 1; else if (agriPrecision) sprintAgri += 1; else sprintCommercial += 1;
        if (realise) sprintRealises += 1;
        if (r.commercial_id) {
          rdvSprintParCommercial[r.commercial_id] = (rdvSprintParCommercial[r.commercial_id] || 0) + 1;
          if (!atelier) rdvSprintParCommercialCommerce[r.commercial_id] = (rdvSprintParCommercialCommerce[r.commercial_id] || 0) + 1;
        }
      }

      if (r.commercial_id) {
        const e = (rdvParCommercial[r.commercial_id] = rdvParCommercial[r.commercial_id] || { total: 0, realises_mois: 0, du_mois: 0, pris_mois: 0, pris_jour: 0, pris_operation: 0 });
        e.total += 1;
        if (duMois) e.du_mois += 1;
        if (duMois && pris) e.pris_mois += 1;
        // « Pris aujourd'hui » = posé aujourd'hui, pas qui a lieu aujourd'hui.
        if (pris && jourPrise === jourAujourdhui) e.pris_jour += 1;
        if (dansOperation(r.date_heure)) e.pris_operation += 1;
        if (duMois && realise) e.realises_mois += 1;
      }
    });

    // ----- Mur des badges : on ne renvoie que les badges ENCORE mérités -----
    // Le Grand Écran tourne en continu : il ne doit jamais afficher un badge
    // devenu caduc (rendez-vous annulé, vente invalidée, données purgées). On
    // revalide ici, en lecture seule, avec les données déjà chargées — donc
    // sans requête ni droit supplémentaire, et sans rien écrire en base.
    const catalogueBadges = new Map(badges.map((b) => [b.id, b]));

    const parUtilisateur = new Map();
    const bac = (id) => {
      if (!parUtilisateur.has(id)) parUtilisateur.set(id, { rdvs: [], ventes: [], clients: [] });
      return parUtilisateur.get(id);
    };
    allRdvs.forEach((r) => {
      if (!r.commercial_id || r.statut === 'Annulé' || !dansOperation(r.date_heure)) return;
      bac(r.commercial_id).rdvs.push(r);
    });
    allVentes.forEach((v) => {
      if (!v.commercial_id || v.statut_validation !== 'Validé' || !dansOperation(v.date_vente)) return;
      bac(v.commercial_id).ventes.push(v);
    });
    allClients.forEach((c) => {
      (c.commerciaux_assignes || []).forEach((id) => bac(id).clients.push(c));
    });

    const merite = (badge, d) => {
      const seuil = badge.condition_seuil || 1;
      const realises = d.rdvs.filter((r) => r.statut === 'Réalisé');
      switch (badge.condition_type) {
        case 'premier_rdv': return d.rdvs.length >= 1;
        case 'sprint_13_14': {
          if (!sprintDebut || !sprintFin) return false;
          return realises.filter((r) => {
            const j = (r.date_heure || '').slice(0, 10);
            return j >= sprintDebut && j <= sprintFin;
          }).length >= (badge.condition_seuil || 3);
        }
        case 'closeur': return d.ventes.length >= 1;
        case 'portefeuille_nettoye':
          return d.clients.length > 0 && !d.clients.some((c) => c.statut === 'À contacter');
        case 'chasseur_reprises':
          return d.ventes.filter((v) => v.reprise && v.reprise !== 'Sans reprise').length >= (badge.condition_seuil || 5);
        case 'premier_devis': return d.clients.some((c) => c.montant_devis > 0);
        case 'serie_active': {
          const jours = new Set();
          d.rdvs.forEach((r) => r.date_heure && jours.add(r.date_heure.slice(0, 10)));
          d.ventes.forEach((v) => v.date_vente && jours.add(v.date_vente));
          d.clients.forEach((c) => dansOperation(c.date_dernier_contact) && jours.add(c.date_dernier_contact));
          const tri = [...jours].sort();
          let suite = tri.length > 0 ? 1 : 0, max = suite;
          for (let i = 1; i < tri.length; i++) {
            const diff = (new Date(tri[i]) - new Date(tri[i - 1])) / 86400000;
            if (diff === 1) { suite += 1; max = Math.max(max, suite); } else suite = 1;
          }
          return max >= (badge.condition_seuil || 3);
        }
        case 'rdv_volume': return realises.length >= (badge.condition_seuil || 10);
        case 'ventes_volume': return d.ventes.length >= (badge.condition_seuil || 3);
        case 'vente_tracteur':
          return d.ventes.filter((v) => v.type_machine === 'Tracteur').length >= (badge.condition_seuil || 3);
        case 'polyvalent':
          return new Set(d.ventes.map((v) => v.type_machine).filter(Boolean)).size >= (badge.condition_seuil || 3);
        case 'rdv_jour': {
          const parJour = {};
          realises.forEach((r) => {
            if (!r.date_heure) return;
            const j = r.date_heure.slice(0, 10);
            parJour[j] = (parJour[j] || 0) + 1;
          });
          return Object.values(parJour).reduce((m, n) => Math.max(m, n), 0) >= (badge.condition_seuil || 5);
        }
        case 'offre_magasin':
          return d.clients.filter((c) => c.statut === 'Offre magasin à proposer').length >= seuil;
        default: return false;
      }
    };

    const vide = { rdvs: [], ventes: [], clients: [] };
    const murBadges = obtenus.filter((o) => {
      const badge = catalogueBadges.get(o.badge_id);
      if (!badge) return false; // badge retiré du catalogue
      return merite(badge, parUtilisateur.get(o.utilisateur_id) || vide);
    });
    const badgesObtenusValides = murBadges.length;

    const ventesParMachine = {};
    const ventesParTypeVente = {};
    const ventesParReprise = {};
    const ventesParCommercial = {};
    const ventesOpParCommercial = {};
    let ventesValidees = 0;
    let ventesValideesMois = 0; // même période que les RDV du mois : taux comparables
    let ventesValideesOp = 0;   // sur la période de l'opération

    ventes.forEach((v) => {
      if (v.statut_validation !== 'Validé') return;
      ventesValidees += 1;
      if (v.date_vente && v.date_vente >= moisDebut.slice(0, 10)) ventesValideesMois += 1;
      if (dansOperation(v.date_vente)) ventesValideesOp += 1;
      const tm = v.type_machine || 'Autre';
      ventesParMachine[tm] = (ventesParMachine[tm] || 0) + 1;
      const tv = v.type_vente || 'Autre';
      ventesParTypeVente[tv] = (ventesParTypeVente[tv] || 0) + 1;
      const rp = v.reprise || 'Sans reprise';
      ventesParReprise[rp] = (ventesParReprise[rp] || 0) + 1;
      if (v.commercial_id) {
        ventesParCommercial[v.commercial_id] = (ventesParCommercial[v.commercial_id] || 0) + 1;
        if (dansOperation(v.date_vente)) {
          ventesOpParCommercial[v.commercial_id] = (ventesOpParCommercial[v.commercial_id] || 0) + 1;
        }
      }
    });

    return Response.json({
      portee,
      maj: new Date().toISOString(),
      clients: {
        total: clients.length,
        par_statut: parStatut,
        // Premier objectif : les cibles choisies par les commerciaux.
        priorites: {
          total: prioTotal,
          a_contacter: prioAContacter,
          traites: prioTotal - prioAContacter,
          rdv: prioRdv,
          ventes: prioVente,
          par_commercial: prioParCommercial
        },
        par_appetence: parAppetence,
        par_commercial: parCommercial,
        par_secteur: parSecteur
      },
      parc: { total: parcTotal, par_categorie: parCategorie },
      atelier: {
        cibles: atelierCibles,
        contactes: atelierContactes,
        ok: atelierOk,
        refus: atelierRefus,
        restants: Math.max(atelierCibles - atelierContactes, 0),
        par_site: atelierParSite,
        // Les plus récents d'abord, pour le fil du Grand Écran.
        recents: atelierRecents
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, 12)
      },
      rdv: {
        // Les auteurs côté atelier : l'écran s'en sert pour que son fil en direct
        // ne montre pas des rendez-vous que ses compteurs ont écartés.
        auteurs_atelier: referents,
        total: rdvs.length - rdvAnnules, // les annulés sont soustraits
        annules: rdvAnnules,
        par_statut: rdvParStatut,
        par_type: rdvParType,
        par_commercial: rdvParCommercial,
        sprint_par_commercial: rdvSprintParCommercial,
        sprint_par_commercial_commerce: rdvSprintParCommercialCommerce,
        du_mois: rdvMois,
        pris_du_mois: rdvPrisMois,
        realises_du_mois: rdvRealisesMois,
        atelier_du_mois: rdvAtelierMois,
        atelier_pris_du_mois: rdvAtelierPrisMois,
        commercial_pris_du_mois: rdvCommercialPrisMois,
        atelier_realises_du_mois: rdvAtelierRealisesMois,
        atelier_hors_annule_du_mois: rdvAtelierHorsAnnuleMois,
        commercial_du_mois: rdvCommercialMois,
        commercial_realises_du_mois: rdvCommercialRealisesMois,
        agri_du_mois: rdvAgriMois,
        agri_pris_du_mois: rdvAgriPrisMois,
        agri_realises_du_mois: rdvAgriRealisesMois,
        // null si les dates d'opération ne sont pas renseignées : les pages
        // retombent alors proprement sur les chiffres du mois.
        operation: (opDebut && opFin) ? {
          debut: opDebut, fin: opFin,
          pris: rdvOpPris, realises: rdvOpRealises,
          commercial: rdvOpCommercial, atelier: rdvOpAtelier, agri: rdvOpAgri
        } : null,
        sprint: { debut: sprintDebut, fin: sprintFin, total: sprintTotal, atelier: sprintAtelier, agri: sprintAgri, commercial: sprintCommercial, realises: sprintRealises }
      },
      ventes: {
        total: ventes.length,
        validees: ventesValidees,
        validees_du_mois: ventesValideesMois,
        validees_operation: (opDebut && opFin) ? ventesValideesOp : null,
        par_commercial: ventesParCommercial,
        operation_par_commercial: (opDebut && opFin) ? ventesOpParCommercial : null,
        par_type_machine: ventesParMachine,
        par_type_vente: ventesParTypeVente,
        par_reprise: ventesParReprise
      },
      offres: { total: offres.length, ca_realise: offres.reduce((s, o) => s + (o.ca_realise || 0), 0) },
      badges: {
        total: badges.length,
        obtenus: badgesObtenusValides,
        // Mur validé : le Grand Écran l'affiche tel quel, sans risque de badge caduc.
        mur: murBadges
          .slice()
          .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))
          .slice(0, 30)
          .map((o) => ({ id: o.id, badge_id: o.badge_id, utilisateur_id: o.utilisateur_id, created_date: o.created_date }))
      },
      structure: { commerciaux: structure.length }
    });
  } catch (error) {
    return Response.json({ error: `[statistiques_operation] ${error?.message || String(error)}` }, { status: 500 });
  }
}