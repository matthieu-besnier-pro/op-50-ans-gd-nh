import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Recalcule les badges d'un commercial (ou de TOUT LE MONDE avec { tous: true }).
// Les badges ne sont pas seulement ajoutés : un badge dont la condition n'est plus
// remplie (rendez-vous annulé, vente invalidée…) est retiré, pour que les compteurs
// affichés — Grand Écran compris — restent justes.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Les clients qui entrent dans les conditions de badge. Pour un porteur donné,
// seules SES fiches comptent : les lire toutes — 6 500 — à chaque changement de
// statut et à chaque prise de rendez-vous rendait l'outil poussif en pleine
// opération. Le recalcul global (Direction) garde la lecture intégrale.
async function listerClients(sr, userId) {
  const out = [];
  for (let i = 0; i < 30; i++) {
    const page = userId
      ? await sr.entities.client.filter({ commerciaux_assignes: { $in: [userId] } }, '-created_date', 1000, i * 1000)
      : await sr.entities.client.list('-created_date', 1000, i * 1000);
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

// Évalue toutes les conditions pour un utilisateur et synchronise ses badges.
async function synchroniser(sr, userId, badges, clients, p) {
  const [obtenus, tousRdvs, ventes] = await Promise.all([
    sr.entities.badge_obtenu.filter({ utilisateur_id: userId }, '-created_date', 100),
    sr.entities.rdv.filter({ commercial_id: userId }, '-created_date', 500),
    sr.entities.vente.filter({ commercial_id: userId }, '-created_date', 500)
  ]);

  // Les badges récompensent l'OPÉRATION : tout ce qui est hors période (essais,
  // reliquats d'anciens tests) ne doit rien débloquer. Sans bornes, on ne filtre pas.
  const debutOp = p.date_debut_operation || null;
  const finOp = p.date_fin_operation || null;
  const dansOperation = (iso) => {
    if (!iso) return false;
    const j = String(iso).slice(0, 10);
    if (debutOp && j < debutOp) return false;
    if (finOp && j > finOp) return false;
    return true;
  };

  // Un rendez-vous annulé ne compte pour aucun badge : il est soustrait d'emblée.
  const rdvs = tousRdvs.filter((r) => r.statut !== 'Annulé' && dansOperation(r.date_heure));
  const ventesOp = ventes.filter((v) => dansOperation(v.date_vente));

  const obtenuParBadge = new Map(obtenus.map((o) => [o.badge_id, o]));
  const nouveaux = [];
  const retires = [];
  const echecs = [];

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
        atteint = ventesOp.some((v) => v.statut_validation === 'Validé');
        break;
      case 'portefeuille_nettoye':
        atteint = mesClients.length > 0 && !mesClients.some((c) => c.statut === 'À contacter');
        break;
      case 'chasseur_reprises':
        atteint = ventesOp.filter((v) => v.reprise && v.reprise !== 'Sans reprise').length >= (badge.condition_seuil || 5);
        break;
      case 'premier_devis':
        atteint = mesClients.some((c) => c.montant_devis > 0);
        break;
      case 'serie_active': {
        // 3 jours consécutifs avec au moins une action (RDV, statut, vente)
        const dates = new Set();
        rdvs.forEach((r) => r.date_heure && dates.add(r.date_heure.slice(0, 10)));
        ventesOp.forEach((v) => dates.add(v.date_vente));
        mesClients.forEach((c) => dansOperation(c.date_dernier_contact) && dates.add(c.date_dernier_contact));
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
        atteint = ventesOp.filter((v) => v.statut_validation === 'Validé').length >= (badge.condition_seuil || 3);
        break;
      case 'vente_tracteur':
        atteint = ventesOp.filter((v) => v.statut_validation === 'Validé' && v.type_machine === 'Tracteur').length >= (badge.condition_seuil || 3);
        break;
      case 'polyvalent': {
        const familles = new Set(ventesOp.filter((v) => v.statut_validation === 'Validé' && v.type_machine).map((v) => v.type_machine));
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
      // On ne déclare un retrait que s'il a réellement eu lieu : sinon le rapport
      // annoncerait un nettoyage qui n'a pas été fait.
      try {
        await sr.entities.badge_obtenu.delete(deja.id);
        retires.push({ badge_id: badge.id, badge_nom: badge.nom });
      } catch (e) {
        echecs.push({ badge_nom: badge.nom, utilisateur_id: userId, raison: e?.message || String(e) });
      }
    }
  }

  // Attributions orphelines : le badge n'existe plus au catalogue. La boucle
  // ci-dessus ne les voit jamais — sans ça elles resteraient comptées à vie.
  const catalogue = new Set(badges.map((b) => b.id));
  for (const o of obtenus) {
    if (!catalogue.has(o.badge_id)) {
      try {
        await sr.entities.badge_obtenu.delete(o.id);
        retires.push({ badge_id: o.badge_id, badge_nom: '(badge supprimé du catalogue)' });
      } catch (e) {
        echecs.push({ badge_nom: '(badge supprimé)', utilisateur_id: userId, raison: e?.message || String(e) });
      }
    }
  }

  return { nouveaux, retires, echecs };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;

    // Recalcul global : toute la base. Sinon, le seul portefeuille concerné.
    const porteur = body.tous ? null : (body.utilisateur_id || user.id);
    const [badges, clients, params] = await Promise.all([
      sr.entities.badge.list('-created_date', 100),
      listerClients(sr, porteur),
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
      const echecs = [];
      for (const id of ids) {
        const r = await synchroniser(sr, id, badges, clients, p);
        ajoutes += r.nouveaux.length;
        supprimes += r.retires.length;
        echecs.push(...r.echecs);
        await sleep(60);
      }
      return Response.json({
        ok: true,
        utilisateurs: ids.size,
        badges_ajoutes: ajoutes,
        badges_retires: supprimes,
        echecs: echecs.slice(0, 20),
        nb_echecs: echecs.length
      });
    }

    // --- Recalcul d'un seul commercial ---
    const userId = body.utilisateur_id || user.id;
    const { nouveaux, retires, echecs } = await synchroniser(sr, userId, badges, clients, p);
    return Response.json({ utilisateur_id: userId, nouveaux_badges: nouveaux, badges_retires: retires, echecs });
  } catch (error) {
    return Response.json({ error: `[verifier_badges] ${error?.message || String(error)}` }, { status: 500 });
  }
}
