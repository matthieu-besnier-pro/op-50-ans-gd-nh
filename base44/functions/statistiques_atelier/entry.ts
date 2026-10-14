import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { avecReprise } from '../../shared/debit.ts';
import { perimetreAtelier, perimetreResponsable, perimetreCommercial, filtreClientsPerimetre, normNom } from '../../shared/perimetre.ts';
import { STATUT_CONTACT_ATELIER_REFUS, STATUTS_CONTACT_ATELIER, rdvAtelierObtenu, routageRdv, TYPE_RDV_ATELIER } from '../../shared/atelier.ts';

// Comptage des contacts pris par les ateliers, pour la moitié « ateliers » du Grand Écran.
//
// Le compteur « OK pour un RDV » affiche le CUMUL des deux façons d'obtenir un
// rendez-vous atelier : le rendez-vous pris dans l'agenda (avec son créneau) et la
// marque du référent d'atelier posée quand le créneau n'est pas encore fixé.
// Un même client n'est compté qu'une fois.
//
// statistiques_operation balaie toutes les données de l'opération : sur un écran qui
// se rafraîchit en continu, ce balayage finissait par dépasser la limite de lecture de
// l'application, et la moitié ateliers restait vide. Ici, on ne lit que les fiches
// concernées par l'atelier — celles du fichier de ciblage, et celles qu'un référent a
// marquées — avec les seuls champs nécessaires : le même comptage, pour une charge
// négligeable.

const CHAMPS = ['id', 'raison_sociale', 'site_atelier', 'statut', 'rdv_obtenus', 'updated_date', 'date_dernier_contact', 'chefs_atelier_ids', 'cible_atelier', 'secteur', 'base_id'];
const LOT = 2000;
const MAX_LOTS = 10;

const VIDE = { cibles: 0, contactes: 0, ok: 0, refus: 0, rdv_pris: 0, restants: 0, par_site: {}, recents: [] };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    const sr = base44.asServiceRole;

    // Périmètre : mêmes règles que le reste de l'opération. Une cible atelier relève
    // aussi de son SITE (site_atelier), pas seulement des clients du commercial.
    const estDirection = user.role === 'admin' || user.app_role === 'direction';

    // Deux familles de fiches entrent dans le comptage : celles du fichier de
    // ciblage, et celles que l'atelier a RÉELLEMENT travaillées — marque « OK pour
    // un RDV » ou « REFUS » — même si elles n'étaient pas dans le fichier (client
    // proposé par un commercial, ou ajouté à la main). Sans cette seconde famille,
    // une prise de contact posée hors fichier ne remontait nulle part : ni au
    // compteur, ni au classement des sites.
    const TOUCHE_PAR_ATELIER = [
      { statut: { $in: STATUTS_CONTACT_ATELIER } },
      { rdv_obtenus: { $in: STATUTS_CONTACT_ATELIER } }
    ];

    let filtre = estDirection ? { $or: [{ cible_atelier: true }, ...TOUCHE_PAR_ATELIER] } : null;
    let idsPerimetre = null;
    let sitesPerimetre = null;

    if (!estDirection) {
      const atelier = await perimetreAtelier(sr, user);
      if (atelier) { idsPerimetre = atelier.ids || []; sitesPerimetre = atelier.sites || []; }
      if (atelier) {
        const branches = [];
        const portees = [
          (atelier.sites || []).length > 0 ? { site_atelier: { $in: atelier.sites } } : null,
          (atelier.ids || []).length > 0 ? { commerciaux_assignes: { $in: atelier.ids } } : null,
          (atelier.secteurs || []).length > 0 ? { secteur: { $in: atelier.secteurs } } : null
        ].filter(Boolean);
        portees.forEach((p) => {
          branches.push({ ...p, cible_atelier: true });
          TOUCHE_PAR_ATELIER.forEach((m) => branches.push({ ...p, ...m }));
        });
        if (branches.length > 0) filtre = { $or: branches };
      } else {
        const equipe = (await perimetreResponsable(sr, user)) || (await perimetreCommercial(sr, user));
        if (equipe) {
          const { $or } = filtreClientsPerimetre(equipe);
          filtre = {
            $or: [
              ...$or.map((b) => ({ ...b, cible_atelier: true })),
              ...$or.flatMap((b) => TOUCHE_PAR_ATELIER.map((m) => ({ ...b, ...m })))
            ]
          };
        }
      }
    }

    if (!filtre) return Response.json({ atelier: VIDE });

    // Lecture paginée, triée par identifiant : aucun doublon, aucun oubli.
    // Une lecture refusée (limite de débit : la situation normale à cinquante postes)
    // est réessayée ; si elle finit par échouer, la fonction le dit au lieu de la
    // masquer — l'écran garde alors ses chiffres précédents plutôt que d'afficher un
    // compteur à zéro, ce qui faisait croire à des contacts et des RDV disparus.
    const clients = [];
    let curseur;
    for (let i = 0; i < MAX_LOTS; i++) {
      const page = await avecReprise(() => sr.entities.client
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
    // Référentiels : une lecture ratée reste sans gravité (le rapprochement retombe
    // alors sur le type de rendez-vous), on ne bloque donc pas le comptage pour eux.
    const [bases, users] = await Promise.all([
      avecReprise(() => sr.entities.base.list('nom', 200)).catch(() => []),
      avecReprise(() => sr.entities.User.list('-created_date', 500)).catch(() => [])
    ]);

    // Site d'une fiche travaillée hors fichier de ciblage. Le fichier atelier porte
    // le site ; une fiche hors fichier n'en a pas : on le déduit du commercial du
    // client (tableau de répartition), à défaut de sa base de rattachement. Sans
    // cela, tous ces contacts tomberaient dans un « Sans site » qui écraserait le
    // classement des ateliers.
    const nomParBase = {};
    const siteParCommercial = {};
    (bases || []).forEach((b) => {
      if (b.id && b.nom) nomParBase[b.id] = b.nom;
      (b.commerciaux || []).forEach((n) => {
        const k = normNom(n);
        if (k && !siteParCommercial[k]) siteParCommercial[k] = b.nom;
      });
    });
    const siteHorsFichier = (c) => {
      const parCommercial = siteParCommercial[normNom(c.secteur || '')];
      if (parCommercial) return parCommercial;
      const parBase = nomParBase[c.base_id] || (bases || []).find((b) => normNom(b.nom) === normNom(c.base_id))?.nom;
      return parBase || 'Sans site';
    };

    // Les rendez-vous d'atelier sont ceux posés par les chefs d'atelier — c'est
    // l'auteur qui tranche, pas le type enregistré (voir routageRdv).
    // Les référents que l'import du fichier atelier a déjà rattachés aux fiches :
    // des identifiants sûrs, et le site qui va avec.
    const idsDesFiches = new Set();
    const siteDesFiches = {};
    clients.forEach((c) => {
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
    // Les rendez-vous d'atelier : lecture la plus critique de la moitié ateliers.
    // Réessayée, et jamais masquée en liste vide — un « RDV posés » à zéro ferait
    // croire que l'atelier n'a rien pris alors que les rendez-vous sont bien là.
    const rdvsLus = await avecReprise(() => sr.entities.rdv.filter(filtreRdv, '-date_heure', 3000));
    const rdvsBruts = Array.isArray(rdvsLus) ? rdvsLus : (rdvsLus?.items || []);

    // Portée : un référent ne voit que ses sites — les siens et ceux de ses
    // commerciaux. Le filtrage se fait ici, le filtre serveur ne sachant pas
    // combiner cette union avec le reste.
    const autorises = idsPerimetre
      ? new Set([
          ...idsPerimetre,
          ...referents.filter((id) => (sitesPerimetre || []).includes(siteParUser[id]))
        ])
      : null;
    const rdvsAtelier = (rdvsBruts || []).filter((r) =>
      r.statut !== 'Annulé' && estAtelier(r) && (!autorises || autorises.has(r.commercial_id))
    );

    let contactes = 0;
    let ok = 0;
    let refus = 0;
    let rdvPris = 0;
    const parSite = {};
    const recents = [];
    const siteParClient = {};
    const nomParClient = {};
    const dejaComptes = new Set();

    clients.forEach((c) => {
      // Fiche du fichier de ciblage, ou fiche travaillée par l'atelier hors fichier.
      const cible = c.cible_atelier === true;
      const site = cible
        ? (String(c.site_atelier || '').trim() || 'Sans site')
        : siteHorsFichier(c);
      siteParClient[c.id] = site;
      nomParClient[c.id] = c.raison_sociale || '';
      const e = (parSite[site] = parSite[site] || { cibles: 0, contactes: 0, ok: 0, refus: 0, rdv: 0 });
      if (cible) e.cibles += 1;

      // Le suivi courant ET les suivis déjà obtenus : le statut n'en garde qu'un.
      const suivis = [c.statut || '', ...(Array.isArray(c.rdv_obtenus) ? c.rdv_obtenus : [])];
      // Rendez-vous pris dans l'agenda ET marque « OK pour un RDV » : cumul.
      const gagne = rdvAtelierObtenu(suivis);
      const perdu = !gagne && suivis.includes(STATUT_CONTACT_ATELIER_REFUS);
      if (!gagne && !perdu) return;

      // Contact posé sur une fiche hors fichier de ciblage : elle a bien été
      // travaillée par l'atelier, elle entre donc au décompte comme les autres.
      if (!cible) e.cibles += 1;

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
        restants: Math.max(cibles - contactes, 0),
        par_site: parSite,
        // Les plus récents d'abord, pour le fil du Grand Écran.
        recents: recents.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12)
      }
    });
  } catch (error) {
    return Response.json({ error: '[statistiques_atelier] ' + error.message }, { status: 500 });
  }
}