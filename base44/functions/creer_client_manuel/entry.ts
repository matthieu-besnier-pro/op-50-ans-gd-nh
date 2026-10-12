import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

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
    const raison = texte(body.raison_sociale).toUpperCase();
    if (raison.length < 2) return Response.json({ error: 'Indiquez la raison sociale du client.' }, { status: 400 });

    const cp = texte(body.code_postal).replace(/\s/g, '');
    if (cp && !/^\d{5}$/.test(cp)) return Response.json({ error: 'Code postal invalide (5 chiffres attendus).' }, { status: 400 });

    const siren = texte(body.siren).replace(/\D/g, '');
    if (siren && siren.length !== 9) return Response.json({ error: 'Le SIREN doit comporter 9 chiffres.' }, { status: 400 });

    const sr = base44.asServiceRole;

    if (siren) {
      const existant = await sr.entities.client.filter({ siren }, 'raison_sociale', 1);
      if (existant.length > 0) {
        return Response.json({ error: `Ce SIREN est déjà rattaché à « ${existant[0].raison_sociale} ».` }, { status: 409 });
      }
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

    const client = await sr.entities.client.create(data);
    return Response.json({ client });
  } catch (error) {
    return Response.json({ error: `[creer_client_manuel] ${error?.message || String(error)}` }, { status: 500 });
  }
}