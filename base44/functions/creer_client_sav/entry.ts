import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { normNom, perimetreAtelier } from '../../shared/perimetre.ts';
import { OFFRES_SAV, comptesDesChefs } from '../../shared/atelier.ts';

// Ajout manuel, depuis « SAV — OP 50 ans », d'un client à cibler par l'atelier,
// avec l'offre SAV à lui proposer (même principe que creer_client_manuel côté commerce).
// Le RLS réservant la création à la Direction, on passe par le rôle service, en posant
// le ciblage atelier — site, chefs du site, offres — pour que le client apparaisse
// aussitôt dans la liste de travail des référents de ce site.
// body.site_atelier : site choisi (parmi ceux du référent ; tous, pour la Direction).
// body.liste_sites  : renvoie seulement les sites proposables (ouverture du formulaire).

const ROLES_ATELIER = ['chef_atelier', 'responsable_sav', 'commercial_chef_atelier'];

const texte = (v) => String(v ?? '').trim();
const union = (a, b) => [...new Set([...(a || []).filter(Boolean), ...(b || []).filter(Boolean)])];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const estDirection = user.role === 'admin' || user.app_role === 'direction';
    if (!estDirection && !ROLES_ATELIER.includes(user.app_role)) {
      return Response.json({ error: "Réservé à l'atelier et à la Direction." }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    // Sites de rattachement : ceux du référent connecté (tableau de répartition) ;
    // la Direction peut viser n'importe quel site.
    const bases = await sr.entities.base.list('nom', 500).catch(() => []);
    const tousSites = [...new Set(bases.map((b) => b.nom).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const perimetre = estDirection ? null : await perimetreAtelier(sr, user);
    const mesSites = (perimetre?.sites || []).filter(Boolean);
    const proposables = estDirection ? tousSites : (mesSites.length > 0 ? mesSites : tousSites);

    if (body.liste_sites) return Response.json({ sites: proposables });

    const raison = texte(body.raison_sociale).toUpperCase();
    if (raison.length < 2) return Response.json({ error: 'Indiquez la raison sociale du client.' }, { status: 400 });

    const cp = texte(body.code_postal).replace(/\s/g, '');
    if (cp && !/^\d{5}$/.test(cp)) return Response.json({ error: 'Code postal invalide (5 chiffres attendus).' }, { status: 400 });

    const siren = texte(body.siren).replace(/\D/g, '');
    if (siren && siren.length !== 9) return Response.json({ error: 'Le SIREN doit comporter 9 chiffres.' }, { status: 400 });

    // L'offre à proposer est le cœur de l'ajout côté atelier : sans elle, la ligne
    // n'aurait rien à appeler.
    const offres = [...new Set((Array.isArray(body.offres_sav) ? body.offres_sav : []).map((o) => texte(o).toUpperCase()))]
      .filter((o) => OFFRES_SAV.includes(o));
    if (offres.length === 0) return Response.json({ error: 'Choisissez au moins une offre SAV à proposer.' }, { status: 400 });

    // Site retenu : celui choisi dans le formulaire, sinon le premier du référent.
    const choisi = texte(body.site_atelier) || mesSites[0] || null;
    const site = bases.find((b) => normNom(b.nom) === normNom(choisi)) || null;
    const nomSite = site?.nom || choisi || null;

    // Référents du site : leurs comptes reçoivent le client (RLS et périmètre),
    // et celui qui l'ajoute le voit toujours, même sans compte rattaché au site.
    const nomsChefs = union(site?.chefs_atelier, [user.full_name || null]);
    const utilisateurs = await sr.entities.User.list('-created_date', 500).catch(() => []);
    const { ids: idsChefs } = comptesDesChefs(nomsChefs, utilisateurs);
    const chefsIds = union(idsChefs, [user.id]);

    // SIREN déjà connu : on laisse le référent trancher (compléter la fiche existante,
    // qui garde son historique, ou créer une seconde fiche).
    let dejaLa = null;
    if (siren) {
      const existant = await sr.entities.client.filter({ siren }, 'raison_sociale', 1);
      dejaLa = existant[0] || null;
    }

    if (dejaLa && !body.forcer && !body.rattacher_existant) {
      return Response.json({
        conflit: 'siren',
        client_existant: { id: dejaLa.id, raison_sociale: dejaLa.raison_sociale || '', siren },
        error: `Ce SIREN est déjà rattaché à « ${dejaLa.raison_sociale} ».`
      }, { status: 200 });
    }

    if (dejaLa && body.rattacher_existant) {
      await sr.entities.client.update(dejaLa.id, {
        cible_atelier: true,
        site_atelier: nomSite || dejaLa.site_atelier || null,
        offres_sav: union(dejaLa.offres_sav, offres),
        usages: union(dejaLa.usages, ['atelier']),
        chefs_atelier: union(dejaLa.chefs_atelier, nomsChefs),
        chefs_atelier_ids: union(dejaLa.chefs_atelier_ids, chefsIds)
      });
      const frais = await sr.entities.client.get(dejaLa.id).catch(() => dejaLa);
      return Response.json({ client: frais, rattache: true });
    }

    const ville = texte(body.ville).toUpperCase();
    const adresse = [texte(body.adresse).toUpperCase(), [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(' ');

    const data = {
      raison_sociale: raison,
      statut: 'À contacter',
      usages: ['atelier'],
      cible_atelier: true,
      site_atelier: nomSite,
      offres_sav: offres,
      chefs_atelier: nomsChefs,
      chefs_atelier_ids: chefsIds,
      parc_total: 0
    };
    if (siren) data.siren = siren;
    if (adresse) data.adresse_complete = adresse;
    if (cp) data.departement = cp.slice(0, 2);
    const mobile = texte(body.tel_mobile);
    if (mobile) data.tel_mobile = mobile;
    const fixe = texte(body.tel_fixe);
    if (fixe) data.tel_fixe = fixe;
    const email = texte(body.email);
    if (email) data.email = email;

    const client = await sr.entities.client.create(data);
    return Response.json({ client });
  } catch (error) {
    return Response.json({ error: `[creer_client_sav] ${error?.message || String(error)}` }, { status: 500 });
  }
}