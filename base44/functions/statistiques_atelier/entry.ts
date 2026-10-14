import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { perimetreAtelier, perimetreResponsable, perimetreCommercial, filtreClientsPerimetre } from '../../shared/perimetre.ts';
import { STATUT_CONTACT_ATELIER_REFUS, rdvAtelierObtenu, comptesDesChefs } from '../../shared/atelier.ts';

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

const CHAMPS = ['id', 'raison_sociale', 'site_atelier', 'statut', 'rdv_obtenus', 'updated_date', 'date_dernier_contact'];
const LOT = 2000;
const MAX_LOTS = 10;

const TYPE_RDV_ATELIER = 'RDV atelier hivernage';
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
    let filtre = estDirection ? { cible_atelier: true } : null;
    let idsPerimetre = null;

    if (!estDirection) {
      const atelier = await perimetreAtelier(sr, user);
      if (atelier) idsPerimetre = atelier.ids || [];
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
      const page = await sr.entities.client
        .filter(filtre, { sort: 'id', limit: LOT, fields: CHAMPS, cursor: curseur })
        .catch(() => []);
      const items = Array.isArray(page) ? page : (page?.items || []);
      clients.push(...items);
      if (Array.isArray(page) || !page?.has_more || !page?.next_cursor) break;
      curseur = page.next_cursor;
    }

    // Les rendez-vous atelier RÉELLEMENT posés, avec leur créneau. Les compter par
    // le seul statut du client laissait de côté tout rendez-vous pris sur une fiche
    // absente du fichier de ciblage : un atelier pouvait en poser des dizaines sans
    // qu'aucun ne remonte.
    const filtreRdv = { type: TYPE_RDV_ATELIER, statut: { $ne: 'Annulé' } };
    if (idsPerimetre) filtreRdv.commercial_id = { $in: idsPerimetre };
    const [rdvsAtelier, bases, users] = await Promise.all([
      sr.entities.rdv.filter(filtreRdv, '-date_heure', 2000).catch(() => []),
      sr.entities.base.list('nom', 200).catch(() => []),
      sr.entities.User.list('-created_date', 500).catch(() => [])
    ]);

    // À quel atelier rattacher un rendez-vous : au site du client quand il est
    // ciblé, sinon à celui de la personne qui l'a posé.
    const siteParUser = {};
    (bases || []).forEach((b) => {
      const noms = [...(b.chefs_atelier || []), ...(b.responsables_sav || [])];
      comptesDesChefs(noms, users || []).ids.forEach((id) => { siteParUser[id] = b.nom; });
    });

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
      const site = String(c.site_atelier || '').trim() || 'Sans site';
      siteParClient[c.id] = site;
      nomParClient[c.id] = c.raison_sociale || '';
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