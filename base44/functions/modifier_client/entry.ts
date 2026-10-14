import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { perimetreCommercial, perimetreResponsable, perimetreAtelier, estDansPerimetre, RESTREINDRE_PAR_FICHE } from '../../shared/perimetre.ts';

// Modification d'une fiche client : raison sociale, SIREN, coordonnées, cible prioritaire.
// Le RLS réserve l'écriture à la Direction : on passe donc par le rôle service, après
// vérification que le demandeur a bien ce client dans son périmètre (le même que celui
// qui lui permet de le voir). Le statut et le suivi commercial restent gérés à part.

const texte = (v) => String(v ?? '').trim();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = texte(body.client_id);
    if (!id) return Response.json({ error: 'Client introuvable.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const client = await sr.entities.client.get(id).catch(() => null);
    if (!client) return Response.json({ error: 'Client introuvable.' }, { status: 404 });

    let autorise = user.role === 'admin' || user.app_role === 'direction'
      || (client.commerciaux_assignes || []).includes(user.id)
      || client.base_responsable_id === user.id;
    if (!autorise) {
      const perimetre = (await perimetreCommercial(sr, user))
        || (await perimetreResponsable(sr, user))
        || (await perimetreAtelier(sr, user));
      autorise = !!perimetre && estDansPerimetre(perimetre)(client);
    }
    if (RESTREINDRE_PAR_FICHE && !autorise) return Response.json({ error: "Cette fiche n'est pas dans votre périmètre." }, { status: 403 });

    const raison = texte(body.raison_sociale).toUpperCase();
    if (raison.length < 2) return Response.json({ error: 'Indiquez la raison sociale du client.' }, { status: 400 });

    const siren = texte(body.siren).replace(/\D/g, '');
    if (siren && siren.length !== 9) return Response.json({ error: 'Le SIREN doit comporter 9 chiffres.' }, { status: 400 });
    // Deux fiches ne peuvent pas porter le même SIREN : c'est la clé de rapprochement des imports.
    if (siren && siren !== texte(client.siren)) {
      const autres = await sr.entities.client.filter({ siren }, 'raison_sociale', 5);
      const autre = (autres || []).find((c) => c.id !== id);
      if (autre) return Response.json({ error: `Ce SIREN est déjà utilisé par « ${autre.raison_sociale} ».` }, { status: 400 });
    }

    const cp = texte(body.code_postal).replace(/\s/g, '');
    if (cp && !/^\d{5}$/.test(cp)) return Response.json({ error: 'Code postal invalide (5 chiffres attendus).' }, { status: 400 });
    const ville = texte(body.ville).toUpperCase();
    const adresse = [texte(body.adresse).toUpperCase(), [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(' ');

    const data = {
      raison_sociale: raison,
      siren: siren || null,
      adresse_complete: adresse || null,
      tel_mobile: texte(body.tel_mobile) || null,
      tel_fixe: texte(body.tel_fixe) || null,
      email: texte(body.email) || null,
      priorite_commercial: !!body.priorite_commercial
    };
    // Le département n'est recalculé que si un code postal a été saisi.
    if (cp) data.departement = cp.slice(0, 2);

    const maj = await sr.entities.client.update(id, data);
    return Response.json({ client: maj });
  } catch (error) {
    return Response.json({ error: `[modifier_client] ${error?.message || String(error)}` }, { status: 500 });
  }
}