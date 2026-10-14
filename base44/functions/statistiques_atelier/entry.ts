import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { avecReprise } from '../../shared/debit.ts';
import { perimetreAtelier, perimetreResponsable, perimetreCommercial, filtreClientsPerimetre } from '../../shared/perimetre.ts';
import { STATUT_CONTACT_ATELIER_REFUS, rdvAtelierObtenu, routageRdv, TYPE_RDV_ATELIER } from '../../shared/atelier.ts';

// Comptage des contacts pris par les ateliers, pour la moitié « ateliers » du Grand Écran.
//
// Le compteur « OK pour un RDV » affiche le CUMUL des deux façons d'obtenir un
// rendez-vous atelier : le rendez-vous pris dans l'agenda (avec son créneau) et la
// marque du référent d'atelier posée quand le créneau n'est pas encore fixé.
// Un même client n'est compté qu'une fois.
//
// statistiques_operation balaie toutes les données de l'opération : sur un écran qui
// se rafraîchit en continu, ce balayage finissait par dépasser la limite de lecture de
// l'application, et la moitié ateliers restait vide. Ici, on ne lit QUE les clients
// ciblés par l'atelier (un peu plus de 800) et seulement les champs nécessaires :
// le même comptage, pour une charge négligeable.

const CHAMPS = ['id', 'raison_sociale', 'site_atelier', 'statut', 'rdv_obtenus', 'updated_date', 'date_dernier_contact', 'chefs_atelier_ids'];
const LOT = 2000;
const MAX_LOTS = 10;

const VIDE = { cibles: 0, contactes: 0, ok: 0, refus: 0, rdv_pris: 0, restants: 0, par_site: {}, recents: [] };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    const sr = base44.asServiceRole;

    // Un comptage PARTIEL est pire que pas de comptage : l'écran afficherait des
    // chiffres en baisse puis en hausse sans que rien n'ait bougé sur le terrain.
    // Chaque lecture est donc réessayée ; si l'une échoue malgré tout, la fonction
    // le dit au lieu de publier un total amputé — l'écran garde alors les siens.
    const lire = (quoi, fn) => avecReprise(fn).catch((e) => {
      throw new Error(`${quoi} — ${e?.message || e}`);
    });

    // Périmètre : mêmes règles que le reste de l'opération. Une cible atelier relève
    // aussi de son SITE (site_atelier), pas seulement des clients du commercial.
    const estDirection = user.role === 'admin' || user.app_role === 'direction';
    let filtre = estDirection ? { cible_atelier: true } : null;
    let idsPerimetre = null;
    let sitesPerimetre = null;

    if (!estDirection) {
      const atelier = await perimetreAtelier(sr, user);
      if (atelier) { idsPerimetre = atelier.ids || []; sitesPerimetre = atelier.sites || []; }
      if (atelier) {
        const branches = [];
        if ((atelier.sites || []).length > 0) branches.push({ cible_atelier: true, site_atelier: { $in: atelier.sites } });
        if ((atelier.ids || []).length > 0) branches.push({ cible_atelier: true, commerciaux_assignes: { $in: atelier.ids } });
        if ((atelier.secteurs || []).length > 0) branches.push({ cible_atelier: true, secteur: { $in: atelier.secteurs } });
        if (branches.length > 0) filtre = { $or: branches };
      } else {
        const equipe = (await perimetreResponsable(sr, user)) || (await perimetreCommercial(sr, user));
        if (equipe) {
          const { $or } = filtreClientsPerimetre(equipe);
          filtre = { $or: $or.map((b) => ({ ...b, cible_atelier: true })) };
        }
      }
    }

    if (!filtre) return Response.json({ atelier: VIDE });

    // Lecture paginée, triée par identifiant : aucun doublon, aucun oubli.
    const clients = [];
    let curseur;
    for (let i = 0; i < MAX_LOTS; i++) {
      const page = await lire('clients', () => sr.entities.client
        .filter(filtre, { sort: 'id', limit: LOT, fields: CHAMPS, cursor: curseur }));
      const items = Array.isArray(page) ? page : (page?.items || []);
      clients.push(...items);
      if (Array.isArray(page) || !page?.has_more || !page?.next_cursor) break;
      curseur = page.next_cursor;
    }

    // Les rendez-vous atelier RÉELLEMENT posés, avec leur créneau. Les compter par
    // le seul statut du client laissait de côté tout rendez-vous pris sur une fiche
    // absente du fichier de ciblage : un atelier pouvait en poser des dizaines sans
    // qu'aucun ne remonte.
    const [bases, users] = await Promise.all([
      lire('sites', () => sr.entities.base.list('nom', 200)),
      lire('comptes', () => sr.entities.User.list('-created_date', 500))
    ]);

    // Carte des fiches ciblées — leur atelier, leur raison sociale, et les
    // référents que l'import du fichier atelier leur a déjà rattachés (des
    // identifiants sûrs, avec le site qui va avec). Construite ICI, avant le tri
    // des rendez-vous, qui s'en sert pour rattacher un rendez-vous à l'atelier
    // de son client.
    const siteParClient = {};
    const nomParClient = {};
    const idsDesFiches = new Set();
    const siteDesFiches = {};
    clients.forEach((c) => {
      siteParClient[c.id] = String(c.site_atelier || '').trim() || 'Sans site';
      nomParClient[c.id] = c.raison_sociale || '';
      (c.chefs_atelier_ids || []).forEach((id) => {
        if (!id) return;
        idsDesFiches.add(id);
        if (!siteDesFiches[id] && c.site_atelier) siteDesFiches[id] = String(c.site_atelier).trim();
      });
    });

    const nomParUser = {};
    (users || []).forEach((u) => { nomParUser[u.id] = u.full_name || u.email || ''; });

    const { siteParUser, estAtelier, referents, cumul } = routageRdv(bases, users, [...idsDesFiches]);
    Object.entries(siteDesFiches).forEach(([id, site]) => { if (!siteParUser[id]) siteParUser[id] = site; });
    // On ratisse large — auteurs reconnus OU type atelier — puis estAtelier
    // tranche. Mieux vaut lire quelques rendez-vous de trop que d'en manquer un.
    const auteurs = [...referents, ...cumul];
    const filtreRdv = auteurs.length > 0
      ? { $or: [{ commercial_id: { $in: auteurs } }, { type: TYPE_RDV_ATELIER }] }
      : { type: TYPE_RDV_ATELIER };
    const rdvsBruts = await lire('rendez-vous', () => sr.entities.rdv.filter(filtreRdv, '-date_heure', 3000));

    // Portée : un référent ne voit que ses sites — les siens et ceux de ses
    // commerciaux. Le filtrage se fait ici, le filtre serveur ne sachant pas
    // combiner cette union avec le reste.
    const autorises = idsPerimetre
      ? new Set([
          ...idsPerimetre,
          ...referents.filter((id) => (sitesPerimetre || []).includes(siteParUser[id]))
        ])
      : null;
    // Un rendez-vous revient à l'atelier de deux façons : son AUTEUR est un
    // référent, OU il porte sur une fiche du fichier de ciblage atelier et il
    // est du type atelier. Sans ce second chemin, un rendez-vous posé par
    // quelqu'un que le tableau de répartition ne nomme pas — chef sans compte,
    // remplaçant, responsable qui cale le créneau — disparaissait purement et
    // simplement, et son atelier restait à zéro.
    const surCible = (r) => !!siteParClient[r.client_id];
    const rdvsAtelier = (rdvsBruts || []).filter((r) => {
      if (r.statut === 'Annulé') return false;
      const releveDeAtelier = estAtelier(r) || (surCible(r) && r.type === TYPE_RDV_ATELIER);
      if (!releveDeAtelier) return false;
      // Portée d'un référent : ses commerciaux, ses collègues de site, et les
      // fiches ciblées de ses ateliers quel que soit l'auteur.
      return !autorises || autorises.has(r.commercial_id) || surCible(r);
    });

    let contactes = 0;
    let ok = 0;
    let refus = 0;
    let rdvPris = 0;
    // Rendez-vous posés PAR CHACUN. C'est la seule activité atelier réellement
    // attribuable à une personne : le marquage d'un contact, lui, n'enregistre
    // pas qui l'a posé — il reste donc une donnée de site.
    const parAuteur = {};
    const parSite = {};
    const recents = [];
    const dejaComptes = new Set();

    clients.forEach((c) => {
      const site = siteParClient[c.id] || 'Sans site';
      const e = (parSite[site] = parSite[site] || { cibles: 0, contactes: 0, ok: 0, refus: 0, rdv: 0 });
      e.cibles += 1;

      // Le suivi courant ET les suivis déjà obtenus : le statut n'en garde qu'un.
      const suivis = [c.statut || '', ...(Array.isArray(c.rdv_obtenus) ? c.rdv_obtenus : [])];
      // Rendez-vous pris dans l'agenda ET marque « OK pour un RDV » : cumul.
      const gagne = rdvAtelierObtenu(suivis);
      const perdu = !gagne && suivis.includes(STATUT_CONTACT_ATELIER_REFUS);
      if (!gagne && !perdu) return;

      e.contactes += 1;
      contactes += 1;
      dejaComptes.add(c.id);
      if (gagne) { e.ok += 1; ok += 1; } else { e.refus += 1; refus += 1; }

      recents.push({
        id: c.id,
        nom: c.raison_sociale || '',
        site,
        refus: perdu,
        date: c.updated_date || c.date_dernier_contact || ''
      });
    });

    // Chaque rendez-vous posé compte pour son atelier. Un client qui n'était pas
    // dans le fichier de ciblage entre ici dans le décompte : il a bien été
    // travaillé, c'est tout ce qui importe pour le tableau de marche.
    let cibles = clients.length;
    (rdvsAtelier || []).forEach((r) => {
      if (!r.client_id) return;
      const site = siteParClient[r.client_id] || siteParUser[r.commercial_id] || 'Sans site';
      const e = (parSite[site] = parSite[site] || { cibles: 0, contactes: 0, ok: 0, refus: 0, rdv: 0 });
      e.rdv += 1;
      rdvPris += 1;
      if (r.commercial_id) parAuteur[r.commercial_id] = (parAuteur[r.commercial_id] || 0) + 1;

      if (!dejaComptes.has(r.client_id)) {
        dejaComptes.add(r.client_id);
        e.cibles += 1;
        cibles += 1;
        e.contactes += 1;
        contactes += 1;
        e.ok += 1;
        ok += 1;
      }

      recents.push({
        id: `rdv-${r.id}`,
        nom: nomParClient[r.client_id] || 'Client',
        site,
        // Qui l'a posé : c'est ce qui permet de voir d'un coup d'œil qu'un
        // référent est bien reconnu, et sur le bon atelier.
        auteur: nomParUser[r.commercial_id] || '',
        refus: false,
        creneau: r.date_heure || '',
        date: r.created_date || r.date_heure || ''
      });
    });

    return Response.json({
      atelier: {
        cibles,
        contactes,
        ok,
        refus,
        rdv_pris: rdvPris,
        rdv_par_auteur: parAuteur,
        restants: Math.max(cibles - contactes, 0),
        par_site: parSite,
        // Les plus récents d'abord, pour le fil du Grand Écran.
        recents: recents.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12)
      }
    });
  } catch (error) {
    // Pas de chiffres plutôt que de faux chiffres : l'écran conserve les derniers
    // connus au lieu de les voir retomber, puis remonter au cycle suivant.
    return Response.json({
      indisponible: true,
      raison: `[statistiques_atelier] ${error?.message || String(error)}`
    });
  }
}