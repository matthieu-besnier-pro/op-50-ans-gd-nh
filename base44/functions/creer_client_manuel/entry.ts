import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { cleNom, cleSite, comptesDesChefs, basesCompletees } from '../../shared/atelier.ts';

// Création manuelle d'un client absent des fichiers d'import.
// Le RLS réserve la création à la Direction : on passe donc par le rôle service,
// en rattachant le client au périmètre du demandeur pour qu'il le retrouve ensuite.

const texte = (v) => String(v ?? '').trim();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;

    // Liste des agences, avec leurs commerciaux : choisir l'agence suffit alors à
    // désigner la bonne personne, au lieu de chercher dans toute la société.
    if (body.liste_agences) {
      const [basesBrutes, fiches] = await Promise.all([
        sr.entities.base.list('nom', 500).catch(() => []),
        sr.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => [])
      ]);
      const compteDuNom = {};
      (fiches || []).forEach((f) => {
        const k = cleNom(f.nom_commercial || '');
        if (k && f.user_id && !compteDuNom[k]) compteDuNom[k] = { id: f.user_id, nom: f.nom_commercial };
      });
      const agences = basesCompletees(basesBrutes).map((b) => ({
        nom: b.nom,
        // Un commercial sans compte encore créé n'est pas proposé : on ne peut
        // rien lui attribuer tant qu'il ne s'est pas connecté.
        commerciaux: (b.commerciaux || [])
          .map((n) => compteDuNom[cleNom(n)])
          .filter(Boolean)
      })).filter((a) => a.nom);
      return Response.json({ agences });
    }

    const raison = texte(body.raison_sociale).toUpperCase();
    if (raison.length < 2) return Response.json({ error: 'Indiquez la raison sociale du client.' }, { status: 400 });

    const cp = texte(body.code_postal).replace(/\s/g, '');
    if (cp && !/^\d{5}$/.test(cp)) return Response.json({ error: 'Code postal invalide (5 chiffres attendus).' }, { status: 400 });

    const siren = texte(body.siren).replace(/\D/g, '');
    if (siren && siren.length !== 9) return Response.json({ error: 'Le SIREN doit comporter 9 chiffres.' }, { status: 400 });

    // SIREN déjà connu : on ne bloque pas le commercial. On lui renvoie la fiche
    // existante pour qu'il choisisse — se l'attribuer (il récupère le parc et
    // l'historique) ou créer quand même une seconde fiche.
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

    const ville = texte(body.ville).toUpperCase();
    const adresse = [texte(body.adresse).toUpperCase(), [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(' ');

    // Rattachement : un commercial crée pour son portefeuille ; les autres rôles
    // désignent éventuellement le commercial destinataire.
    let commerciaux = [];
    let responsableId = null;
    let secteur = null; // nom du commercial : sert au ciblage par secteur
    if (user.app_role === 'commercial' || user.app_role === 'agri_precision') {
      commerciaux = [user.id];
      const moi = await sr.entities.structure_commerciale.filter({ user_id: user.id }, 'nom_commercial', 1);
      if (moi.length > 0) secteur = moi[0].nom_commercial || null;
    } else {
      const cible = texte(body.commercial_id);
      if (cible) {
        const fiche = await sr.entities.structure_commerciale.filter({ user_id: cible }, 'nom_commercial', 1);
        if (fiche.length > 0) { commerciaux = [cible]; secteur = fiche[0].nom_commercial || null; }
      }
      if (user.app_role === 'responsable') responsableId = user.id;
    }

    // Se l'attribuer : on ajoute le demandeur au client existant, sans rien dupliquer.
    if (dejaLa && body.rattacher_existant) {
      const actuels = dejaLa.commerciaux_assignes || [];
      const aAjouter = commerciaux.length > 0 ? commerciaux[0] : user.id;
      const maj = {};
      if (!actuels.includes(aAjouter)) maj.commerciaux_assignes = [...actuels, aAjouter];
      if (body.priorite_commercial) maj.priorite_commercial = true;
      if (Object.keys(maj).length > 0) await sr.entities.client.update(dejaLa.id, maj);
      const frais = await sr.entities.client.get(dejaLa.id).catch(() => dejaLa);
      return Response.json({ client: frais, rattache: true });
    }

    const data = { raison_sociale: raison, statut: 'À contacter' };
    if (siren) data.siren = siren;
    if (adresse) data.adresse_complete = adresse;
    if (cp) data.departement = cp.slice(0, 2);
    const mobile = texte(body.tel_mobile);
    if (mobile) data.tel_mobile = mobile;
    const fixe = texte(body.tel_fixe);
    if (fixe) data.tel_fixe = fixe;
    const email = texte(body.email);
    if (email) data.email = email;
    if (commerciaux.length > 0) data.commerciaux_assignes = commerciaux;
    if (responsableId) data.base_responsable_id = responsableId;
    if (secteur) data.secteur = secteur;
    // Prospect ajouté à la main et déjà ciblé par le commercial.
    if (body.priorite_commercial) data.priorite_commercial = true;

    // Agence de rattachement : le client porte son site et ses référents
    // d'atelier, pour que le suivi SAV sache à qui il revient. Il n'entre pas
    // pour autant dans le fichier de ciblage atelier — c'est le rôle de la
    // création côté SAV.
    const siteChoisi = texte(body.site_atelier);
    if (siteChoisi) {
      const bases = basesCompletees(await sr.entities.base.list('nom', 500).catch(() => []));
      const site = bases.find((b) => cleSite(b.nom) === cleSite(siteChoisi));
      if (site) {
        data.site_atelier = site.nom;
        const chefs = [...(site.chefs_atelier || []), ...(site.responsables_sav || [])].filter(Boolean);
        if (chefs.length > 0) {
          data.chefs_atelier = chefs;
          const users = await sr.entities.User.list('-created_date', 500).catch(() => []);
          const ids = comptesDesChefs(chefs, users || []).ids;
          if (ids.length > 0) data.chefs_atelier_ids = ids;
        }
      }
    }

    const client = await sr.entities.client.create(data);
    return Response.json({ client });
  } catch (error) {
    return Response.json({ error: `[creer_client_manuel] ${error?.message || String(error)}` }, { status: 500 });
  }
}