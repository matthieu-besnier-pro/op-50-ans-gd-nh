import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Invite l'équipe en une fois, avec les VRAIES adresses professionnelles.
// Chaque personne reçoit l'invitation Base44 et choisit son mot de passe.
// Au passage : rôle appliqué, fiche commerciale rattachée, secteur conservé.
//
// UN SEUL mail part, et il est en français : celui que nous rédigeons.
// L'invitation Base44 (en anglais, non pilotable) n'est pas envoyée par défaut —
// elle n'est de toute façon pas nécessaire : le compte se crée à la première
// connexion (Google ou « Créer mon accès ») et rattacher_comptes applique alors
// le rôle et le portefeuille.
//
// body = {
//   lignes: [{ nom, email, role }],   // role : commercial | responsable | ...
//   avec_invitation: false,           // true = envoyer aussi l'invitation Base44
//   dry_run: true                     // aperçu sans rien envoyer
// }

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Insensible à l'ordre prénom/nom : « BELLIN Alexandre » = « Alexandre BELLIN ».
const cle = (s) => norm(s).split(' ').filter(Boolean).sort().join(' ');

const emailValide = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

const LIEN_APP = 'https://op-50-ans-gd-nh.base44.app';

const ROLE_LISIBLE = {
  commercial: 'Commercial',
  agri_precision: 'Agriculture de précision',
  responsable: 'Responsable commercial',
  chef_atelier: "Chef d'atelier",
  responsable_sav: 'Responsable SAV',
  collaborateur: 'Collaborateur',
  direction: 'Direction / Marketing'
};

// Base44 envoie ses mails d'authentification en anglais, et nous ne les
// pilotons pas. On double donc l'invitation d'un message en français qui
// explique la marche à suivre.
function messageBienvenue(nom, email, role) {
  const prenom = String(nom || '').trim().split(' ')[0] || 'Bonjour';
  return {
    sujet: 'CockpitOP — votre accès à l\'opération 50 ans',
    corps: [
      `Bonjour ${prenom},`,
      '',
      `Votre accès à CockpitOP est ouvert pour l'opération des 50 ans Gonnin Duris × New Holland (13 au 30 octobre).`,
      `Vous y retrouverez vos clients, vos rendez-vous et vos cibles prioritaires.`,
      '',
      `Profil : ${ROLE_LISIBLE[role] || role}`,
      `Adresse de connexion : ${email}`,
      '',
      `POUR VOUS CONNECTER — ${LIEN_APP}`,
      '',
      `• Le plus simple : cliquez sur « Continuer avec Google » et utilisez votre adresse professionnelle. Rien d'autre à faire.`,
      `• Sinon : cliquez sur « Créer mon accès », saisissez l'adresse ci-dessus et choisissez votre mot de passe. Un code de confirmation vous sera envoyé.`,
      '',
      `Bonne opération,`,
      `L'équipe CockpitOP`
    ].join('\n')
  };
}

// Envoi tolérant : si l'intégration n'est pas disponible, l'invitation reste
// valable, on le signale simplement dans le compte rendu.
async function envoyerBienvenue(base44, sr, nom, email, role) {
  const { sujet, corps } = messageBienvenue(nom, email, role);
  const charge = { to: email, subject: sujet, body: corps };
  // L'envoi d'email n'est autorisé qu'en service-role : un appel depuis le client
  // de l'utilisateur est refusé par la plateforme (restriction de routage).
  // On appelle la méthode sur son objet, sans l'extraire : elle perdrait son contexte.
  // Seul le canal service est accepté : pas de repli côté client (refusé par la plateforme).
  try {
    await sr.integrations.Core.SendEmail(charge);
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e?.message || String(e) };
  }
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
          // Invitation plateforme : seulement si on la demande explicitement
          // (elle déclenche un second mail, en anglais).
          if (body.avec_invitation) {
            try {
              await base44.users.inviteUser(email, 'user');
            } catch (e) {
              const msg = String(e?.message || e);
              if (!/exist|déjà|already|duplicate/i.test(msg)) {
                resultats.push({ nom, email, etat: 'erreur', detail: `Invitation refusée : ${msg}` });
                continue;
              }
            }
          }
          // Le compte n'existe qu'à la première connexion : inutile d'attendre.
          let cree = null;
          if (body.avec_invitation) {
            for (let essai = 0; essai < 3 && !cree; essai++) {
              await new Promise((r) => setTimeout(r, 400 + essai * 400));
              const frais = await sr.entities.User.list('-created_date', 500);
              cree = frais.find((u) => (u.email || '').toLowerCase() === email) || null;
            }
          }
          if (!cree) {
            // Comportement NORMAL de Base44 : le compte n'existe qu'à la première
            // connexion. L'invitation est bien partie ; le rôle et le portefeuille
            // seront rattachés automatiquement à ce moment-là (rattacher_comptes).
            // On mémorise l'adresse sur la fiche : c'est elle qui servira de clé.
            if (fiche) {
              await sr.entities.structure_commerciale
                .update(fiche.id, { email, statut: 'Invité' })
                .catch(() => {});
            }
            const envoi = await envoyerBienvenue(base44, sr, nom, email, role);
            resultats.push({
              nom, email, role, etat: envoi.ok ? 'invite' : 'erreur',
              detail: envoi.ok
                ? 'Mode d\'emploi envoyé — rôle et portefeuille rattachés à sa première connexion'
                : `Mail non envoyé (${envoi.detail}) — cochez « Ajouter l'invitation de la plateforme » pour qu'elle reçoive au moins le message d'origine.`
            });
            continue;
          }
          userId = cree.id;
          parEmail[email] = cree;
        }

        // Le compte existe : même si le rôle ou le rattachement échoue, l'accès est
        // créé. On le signale sans faire passer toute la ligne en erreur.
        const soucis = [];
        try {
          const maj = { app_role: role };
          if (nom) maj.full_name = nom;
          if (fiche?.codes_communes) maj.codes_communes = fiche.codes_communes;
          await sr.entities.User.update(userId, maj);
        } catch (e) {
          soucis.push(`rôle non appliqué (${e?.message || e})`);
        }

        if (fiche) {
          try {
            await sr.entities.structure_commerciale.update(fiche.id, {
              user_id: userId,
              email,
              statut: 'Invité'
            });
          } catch (e) {
            soucis.push(`fiche non rattachée (${e?.message || e})`);
          }
        }

        resultats.push({
          nom, email, role,
          etat: existant ? 'mis_a_jour' : 'invite',
          detail: soucis.length
            ? soucis.join(' · ')
            : (fiche ? `Rattaché à « ${fiche.nom_commercial} »` : 'Aucune fiche commerciale à rattacher')
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