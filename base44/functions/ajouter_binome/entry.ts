import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normNom } from '../../shared/perimetre.ts';

// Deux commerciaux sur un même secteur (binôme). On crée la fiche du second si
// elle manque, et on l'ajoute aux clients du secteur — sans retirer le premier,
// puisqu'un client peut être partagé.
//
// body = { nom, secteur, manager?, dry_run? }

const CHUNK = 2000;
const cle = (v) => normNom(v).split(' ').filter(Boolean).sort().join(' ');

async function lireTout(fetchPage) {
  const out = [];
  for (let i = 0; i < 20; i++) {
    const page = await fetchPage(i * CHUNK);
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < CHUNK) break;
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const nom = String(body.nom || '').trim();
    const secteur = String(body.secteur || '').trim();
    if (!nom || !secteur) return Response.json({ error: 'Indiquez le commercial et le secteur.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const [fiches, utilisateurs] = await Promise.all([
      sr.entities.structure_commerciale.list('-nom_commercial', 500),
      sr.entities.User.list('-created_date', 500)
    ]);

    // Compte du binôme : par nom complet, sinon par l'identifiant de son adresse.
    const k = cle(nom);
    const compte = utilisateurs.find((u) =>
      cle(u.full_name || '') === k ||
      cle(String(u.email || '').split('@')[0].replace(/[._-]+/g, ' ')) === k
    ) || null;

    // Clients du secteur de référence.
    const clients = await lireTout((skip) => sr.entities.client.list('id', CHUNK, skip));
    const kSecteur = normNom(secteur);
    const duSecteur = clients.filter((c) => normNom(c.secteur) === kSecteur);

    const fiche = fiches.find((f) => cle(f.nom_commercial) === k) || null;
    const modele = fiches.find((f) => normNom(f.nom_commercial) === kSecteur) || null;

    if (body.dry_run) {
      return Response.json({
        ok: true, dry_run: true,
        compte_trouve: !!compte,
        fiche_existante: !!fiche,
        clients_du_secteur: duSecteur.length,
        deja_affectes: compte ? duSecteur.filter((c) => (c.commerciaux_assignes || []).includes(compte.id)).length : 0
      });
    }

    // 1. Fiche du binôme : créée si absente, alignée sur le secteur de référence.
    let ficheId = fiche?.id || null;
    const champs = {
      nom_commercial: nom,
      manager: body.manager || modele?.manager || fiche?.manager || null,
      entite: modele?.entite || fiche?.entite || null,
      zone: modele?.zone || fiche?.zone || null,
      concession: modele?.concession || fiche?.concession || null,
      codes_communes: modele?.codes_communes || fiche?.codes_communes || []
    };
    Object.keys(champs).forEach((c) => { if (champs[c] == null) delete champs[c]; });
    if (ficheId) {
      await sr.entities.structure_commerciale.update(ficheId, champs).catch(() => {});
    } else {
      const creee = await sr.entities.structure_commerciale.create(champs);
      ficheId = creee?.id || null;
    }

    // 2. Rattachement aux clients du secteur (le titulaire reste en place).
    let ajoutes = 0;
    if (compte) {
      for (const c of duSecteur) {
        const actuels = c.commerciaux_assignes || [];
        if (actuels.includes(compte.id)) continue;
        await sr.entities.client
          .update(c.id, { commerciaux_assignes: [...actuels, compte.id] })
          .catch(() => {});
        ajoutes++;
      }
      if (ficheId) await sr.entities.structure_commerciale.update(ficheId, { user_id: compte.id }).catch(() => {});
    }

    return Response.json({
      ok: true,
      fiche: ficheId ? (fiche ? 'mise à jour' : 'créée') : 'non créée',
      compte_trouve: !!compte,
      clients_du_secteur: duSecteur.length,
      clients_ajoutes: ajoutes,
      note: compte
        ? null
        : "Le compte n'existe pas encore : invitez cette personne, puis relancez pour lui rattacher les clients du secteur."
    });
  } catch (error) {
    return Response.json({ error: `[ajouter_binome] ${error?.message || String(error)}` }, { status: 500 });
  }
}
