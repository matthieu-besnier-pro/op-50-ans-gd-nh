import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Invite l'équipe en une fois, avec les VRAIES adresses professionnelles.
// Chaque personne reçoit l'invitation Base44 et choisit son mot de passe.
// Au passage : rôle appliqué, fiche commerciale rattachée, secteur conservé.
//
// body = {
//   lignes: [{ nom, email, role }],   // role : commercial | responsable | ...
//   dry_run: true                     // aperçu sans rien créer
// }

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Insensible à l'ordre prénom/nom : « BELLIN Alexandre » = « Alexandre BELLIN ».
const cle = (s) => norm(s).split(' ').filter(Boolean).sort().join(' ');

const emailValide = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const lignes = Array.isArray(body.lignes) ? body.lignes : [];
    if (lignes.length === 0) return Response.json({ error: 'Aucune personne à inviter.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const [structure, utilisateurs] = await Promise.all([
      sr.entities.structure_commerciale.list('-nom_commercial', 500),
      sr.entities.User.list('-created_date', 500)
    ]);

    const parEmail = {};
    utilisateurs.forEach((u) => { if (u.email) parEmail[u.email.toLowerCase()] = u; });
    const ficheParNom = {};
    structure.forEach((s) => { if (s.nom_commercial) ficheParNom[cle(s.nom_commercial)] = s; });

    const resultats = [];
    for (const l of lignes) {
      const nom = String(l.nom || '').trim();
      const email = String(l.email || '').trim().toLowerCase();
      const role = l.role || 'commercial';
      const fiche = ficheParNom[cle(nom)] || null;

      if (!emailValide(email)) {
        resultats.push({ nom, email, etat: 'erreur', detail: 'Adresse email invalide' });
        continue;
      }

      const existant = parEmail[email];
      if (body.dry_run) {
        resultats.push({
          nom, email, role,
          etat: existant ? 'deja_present' : 'a_inviter',
          detail: fiche ? `Fiche « ${fiche.nom_commercial} »` : 'Aucune fiche commerciale trouvée'
        });
        continue;
      }

      try {
        let userId = existant?.id;
        if (!userId) {
          await base44.users.inviteUser(email, 'user');
          // L'utilisateur n'est pas disponible immédiatement après l'invitation.
          await new Promise((r) => setTimeout(r, 600));
          const frais = await sr.entities.User.list('-created_date', 500);
          const cree = frais.find((u) => (u.email || '').toLowerCase() === email);
          if (!cree) {
            resultats.push({ nom, email, etat: 'erreur', detail: 'Compte introuvable après invitation' });
            continue;
          }
          userId = cree.id;
          parEmail[email] = cree;
        }

        const maj = { app_role: role };
        if (nom) maj.full_name = nom;
        if (fiche?.codes_communes) maj.codes_communes = fiche.codes_communes;
        await sr.entities.User.update(userId, maj);

        if (fiche) {
          await sr.entities.structure_commerciale.update(fiche.id, {
            user_id: userId,
            email,
            statut: 'Invité'
          });
        }

        resultats.push({
          nom, email, role,
          etat: existant ? 'mis_a_jour' : 'invite',
          detail: fiche ? `Rattaché à « ${fiche.nom_commercial} »` : 'Aucune fiche commerciale à rattacher'
        });
      } catch (e) {
        resultats.push({ nom, email, etat: 'erreur', detail: e?.message || String(e) });
      }
    }

    const compte = (etat) => resultats.filter((r) => r.etat === etat).length;
    return Response.json({
      ok: true,
      dry_run: Boolean(body.dry_run),
      total: resultats.length,
      invites: compte('invite'),
      mis_a_jour: compte('mis_a_jour'),
      deja_present: compte('deja_present'),
      a_inviter: compte('a_inviter'),
      erreurs: compte('erreur'),
      resultats
    });
  } catch (error) {
    return Response.json({ error: `[inviter_equipe] ${error?.message || String(error)}` }, { status: 500 });
  }
}
