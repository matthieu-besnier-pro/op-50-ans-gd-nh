import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Recalcule les badges d'un commercial (ou de TOUT LE MONDE avec { tous: true }).
// Les badges ne sont pas seulement ajoutés : un badge dont la condition n'est plus
// remplie (rendez-vous annulé, vente invalidée…) est retiré, pour que les compteurs
// affichés — Grand Écran compris — restent justes.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Évalue toutes les conditions pour un utilisateur et synchronise ses badges.
async function synchroniser(sr, userId, badges, clients, p) {
  const [obtenus, tousRdvs, ventes] = await Promise.all([
    sr.entities.badge_obtenu.filter({ utilisateur_id: userId }, '-created_date', 100),
    sr.entities.rdv.filter({ commercial_id: userId }, '-created_date', 500),
    sr.entities.vente.filter({ commercial_id: userId }, '-created_date', 500)
  ]);

  // Un rendez-vous annulé ne compte pour aucun badge : il est soustrait d'emblée.
  const rdvs = tousRdvs.filter((r) => r.statut !== 'Annulé');

  const obtenuParBadge = new Map(obtenus.map((o) => [o.badge_id, o]));
  const nouveaux = [];
  const retires = [];

  const debutRdv = p.date_debut_prise_rdv ? new Date(p.date_debut_prise_rdv) : null;
  const finRdv = p.date_fin_prise_rdv ? new Date(p.date_fin_prise_rdv + 'T23:59:59') : null;
  const mesClients = clients.filter((c) => (c.commerciaux_assignes || []).includes(userId));

  for (const badge of badges) {
    let atteint = false;
    switch (badge.condition_type) {
      case 'premier_rdv':
        atteint = rdvs.length >= 1;
        break;
      case 'sprint_13_14': {
        const count = rdvs.filter((r) => {
          if (!debutRdv || !finRdv) return false;
          const d = new Date(r.date_heure);
          return d >= debutRdv && d <= finRdv && r.statut === 'Réalisé';
        }).length;
        atteint = count >= (badge.condition_seuil || 3);
        break;
      }
      case 'closeur':
        atteint = ventes.some((v) => v.statut_validation === 'Validé');
        break;
      case 'portefeuille_nettoye':
        atteint = mesClients.length > 0 && !mesClients.some((c) => c.statut === 'À contacter');
        break;
      case 'chasseur_reprises':
        atteint = ventes.filter((v) => v.reprise && v.reprise !== 'Sans reprise').length >= (badge.condition_seuil || 5);
        break;
      case 'premier_devis':
        atteint = mesClients.some((c) => c.montant_devis > 0);
        break;
      case 'serie_active': {
        // 3 jours consécutifs avec au moins une action (RDV, statut, vente)
        const dates = new Set();
        rdvs.forEach((r) => r.date_heure && dates.add(r.date_heure.slice(0, 10)));
        ventes.forEach((v) => v.date_vente && dates.add(v.date_vente));
        mesClients.forEach((c) => c.date_dernier_contact && dates.add(c.date_dernier_contact));
        const sorted = [...dates].sort();
        let streak = 1, max = sorted.length > 0 ? 1 : 0;
        for (let i = 1; i < sorted.length; i++) {
          const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
          if (diff === 1) { streak++; max = Math.max(max, streak); } else streak = 1;
        }
        atteint = max >= 3;
        break;
      }
      case 'rdv_volume':
        atteint = rdvs.filter((r) => r.statut === 'Réalisé').length >= (badge.condition_seuil || 10);
        break;
      case 'ventes_volume':
        atteint = ventes.filter((v) => v.statut_validation === 'Validé').length >= (badge.condition_seuil || 3);
        break;
      case 'vente_tracteur':
        atteint = ventes.filter((v) => v.statut_validation === 'Validé' && v.type_machine === 'Tracteur').length >= (badge.condition_seuil || 3);
        break;
      case 'polyvalent': {
        const familles = new Set(ventes.filter((v) => v.statut_validation === 'Validé' && v.type_machine).map((v) => v.type_machine));
        atteint = familles.size >= (badge.condition_seuil || 3);
        break;
      }
      case 'rdv_jour': {
        const parJour = {};
        rdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure).forEach((r) => {
          const d = r.date_heure.slice(0, 10);
          parJour[d] = (parJour[d] || 0) + 1;
        });
        const maxJour = Object.values(parJour).reduce((m, n) => Math.max(m, n), 0);
        atteint = maxJour >= (badge.condition_seuil || 5);
        break;
      }
      case 'offre_magasin':
        atteint = mesClients.filter((c) => c.statut === 'Offre magasin à proposer').length >= (badge.condition_seuil || 1);
        break;
    }

    const deja = obtenuParBadge.get(badge.id);
    if (atteint && !deja) {
      await sr.entities.badge_obtenu.create({ badge_id: badge.id, utilisateur_id: userId });
      nouveaux.push({ badge_id: badge.id, badge_nom: badge.nom, badge_icone: badge.icone });
    } else if (!atteint && deja) {
      await sr.entities.badge_obtenu.delete(deja.id).catch(() => {});
      retires.push({ badge_id: badge.id, badge_nom: badge.nom });
    }
  }

  return { nouveaux, retires };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;

    const [badges, clients, params] = await Promise.all([
      sr.entities.badge.list('-created_date', 100),
      sr.entities.client.filter({}, '-created_date', 5000),
      sr.entities.parametres_operation.list('-created_date', 1)
    ]);
    const p = params[0] || {};

    // --- Recalcul global (purge les badges hérités d'anciennes données) ---
    if (body.tous) {
      const estDirection = user.role === 'admin' || user.app_role === 'direction';
      if (!estDirection) return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });

      // Tous les porteurs de badges + tous les profils terrain, pour ne rien oublier.
      const [tousObtenus, users] = await Promise.all([
        sr.entities.badge_obtenu.list('-created_date', 5000),
        sr.entities.User.list('-created_date', 500).catch(() => [])
      ]);
      const ids = new Set();
      tousObtenus.forEach((o) => o.utilisateur_id && ids.add(o.utilisateur_id));
      users.forEach((u) => {
        if (['commercial', 'agri_precision', 'responsable'].includes(u.app_role)) ids.add(u.id);
      });

      let ajoutes = 0, supprimes = 0;
      for (const id of ids) {
        const r = await synchroniser(sr, id, badges, clients, p);
        ajoutes += r.nouveaux.length;
        supprimes += r.retires.length;
        await sleep(60);
      }
      return Response.json({ ok: true, utilisateurs: ids.size, badges_ajoutes: ajoutes, badges_retires: supprimes });
    }

    // --- Recalcul d'un seul commercial ---
    const userId = body.utilisateur_id || user.id;
    const { nouveaux, retires } = await synchroniser(sr, userId, badges, clients, p);
    return Response.json({ utilisateur_id: userId, nouveaux_badges: nouveaux, badges_retires: retires });
  } catch (error) {
    return Response.json({ error: `[verifier_badges] ${error?.message || String(error)}` }, { status: 500 });
  }
}
