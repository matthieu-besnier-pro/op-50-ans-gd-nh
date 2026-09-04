import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Vérifie toutes les conditions de badges pour un commercial et crée les BadgeObtenu manquants.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json();
    const userId = body.utilisateur_id || user.id;

    const sr = base44.asServiceRole;

    const [badges, obtenus, rdvs, ventes, clients, params] = await Promise.all([
      sr.entities.badge.list('-created_date', 100),
      sr.entities.badge_obtenu.filter({ utilisateur_id: userId }, '-created_date', 100),
      sr.entities.rdv.filter({ commercial_id: userId }, '-created_date', 500),
      sr.entities.vente.filter({ commercial_id: userId }, '-created_date', 500),
      sr.entities.client.filter({}, '-created_date', 500),
      sr.entities.parametres_operation.list('-created_date', 1)
    ]);

    const dejaObtenus = new Set(obtenus.map((o) => o.badge_id));
    const nouveaux = [];

    const now = new Date();
    const p = params[0] || {};
    const debutRdv = p.date_debut_prise_rdv ? new Date(p.date_debut_prise_rdv) : null;
    const finRdv = p.date_fin_prise_rdv ? new Date(p.date_fin_prise_rdv + "T23:59:59") : null;

    for (const badge of badges) {
      if (dejaObtenus.has(badge.id)) continue;
      let atteint = false;
      switch (badge.condition_type) {
        case "premier_rdv":
          atteint = rdvs.length >= 1;
          break;
        case "sprint_13_14": {
          const count = rdvs.filter((r) => {
            if (!debutRdv || !finRdv) return false;
            const d = new Date(r.date_heure);
            return d >= debutRdv && d <= finRdv && r.statut === "Réalisé";
          }).length;
          atteint = count >= (badge.condition_seuil || 3);
          break;
        }
        case "closeur":
          atteint = ventes.some((v) => v.statut_validation === "Validé");
          break;
        case "portefeuille_nettoye":
          atteint = !clients.some((c) => (c.commerciaux_assignes || []).includes(userId) && c.statut === "À contacter");
          break;
        case "chasseur_reprises":
          atteint = ventes.filter((v) => v.reprise && v.reprise !== "Sans reprise").length >= (badge.condition_seuil || 5);
          break;
        case "premier_devis":
          atteint = clients.some((c) => (c.commerciaux_assignes || []).includes(userId) && c.montant_devis > 0);
          break;
        case "serie_active":
          // 3 jours consécutifs avec au moins une action (RDV, statut, vente)
          {
            const dates = new Set();
            rdvs.forEach((r) => r.date_heure && dates.add(r.date_heure.slice(0, 10)));
            ventes.forEach((v) => v.date_vente && dates.add(v.date_vente));
            clients.forEach((c) => (c.commerciaux_assignes || []).includes(userId) && c.date_dernier_contact && dates.add(c.date_dernier_contact));
            const sorted = [...dates].sort();
            let streak = 1, max = 1;
            for (let i = 1; i < sorted.length; i++) {
              const prev = new Date(sorted[i - 1]);
              const cur = new Date(sorted[i]);
              const diff = (cur - prev) / (1000 * 60 * 60 * 24);
              if (diff === 1) { streak++; max = Math.max(max, streak); }
              else streak = 1;
            }
            atteint = max >= 3;
          }
          break;
      }
      if (atteint) {
        const o = await sr.entities.badge_obtenu.create({ badge_id: badge.id, utilisateur_id: userId });
        nouveaux.push({ badge_id: badge.id, badge_nom: badge.nom, badge_icone: badge.icone });
      }
    }

    return Response.json({ utilisateur_id: userId, nouveaux_badges: nouveaux });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}