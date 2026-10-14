import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { perimetreResponsable, perimetreAtelier } from '../../shared/perimetre.ts';
import { cleSite, cleNom, comptesDesChefs } from '../../shared/atelier.ts';

// Effectif des chefs d'atelier d'une liste de sites. TOUS y figurent, qu'ils
// aient déjà un compte ou non : l'équipe doit être complète, comme l'est la
// liste des commerciaux côté commerce, qui vient du fichier d'import. Un chef
// sans compte apparaît simplement sans activité — et son absence se voit, au
// lieu de passer inaperçue.
function effectifChefs(mesBases, comptes) {
  const parCle = new Map();
  for (const b of mesBases) {
    for (const nom of (b.chefs_atelier || [])) {
      if (!nom) continue;
      const cle = cleNom(nom);
      const deja = parCle.get(cle);
      // Un même chef peut couvrir plusieurs sites : une seule ligne, tous ses sites.
      if (deja) {
        if (b.nom && !deja.sites.includes(b.nom)) deja.sites.push(b.nom);
        continue;
      }
      const { ids } = comptesDesChefs([nom], comptes);
      const compte = ids.length === 1 ? comptes.find((u) => u.id === ids[0]) : null;
      parCle.set(cle, {
        id: compte?.id || `chef:${cle}`,
        user_id: compte?.id || null,
        full_name: compte?.full_name || nom,
        email: compte?.email || '',
        sites: b.nom ? [b.nom] : []
      });
    }
  }
  return [...parCle.values()];
}

// Renvoie les membres de l'équipe du responsable connecté (ou toute l'équipe pour la Direction).
// Les non-admins ne peuvent pas lister les utilisateurs via le SDK client — d'où cette fonction en service role.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const appRole = user.app_role || 'collaborateur';
    const isAdmin = user.role === 'admin' || appRole === 'direction';

    // Le responsable SAV encadre lui aussi une équipe : ses chefs d'atelier.
    const estResponsableSav = appRole === 'responsable_sav';
    if (!isAdmin && appRole !== 'responsable' && !estResponsableSav) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 });
    }

    let teamBaseIds = [];
    let teamMembers = [];
    // Noms des vendeurs de l'équipe : la page s'en sert pour ne garder que les
    // fiches concernées. null = aucune restriction (Direction).
    let fiches = null;

    // « Voir en tant que » un référent d'atelier : la Direction demande l'équipe
    // de sites précis. Sans cela la page retombait sur le compte réellement
    // connecté — et affichait une équipe vide.
    const sitesDemandes = Array.isArray(body?.sites) ? body.sites.filter(Boolean) : [];

    if (isAdmin && sitesDemandes.length > 0) {
      const bases = await sr.entities.base.list('nom', 500).catch(() => []);
      const vises = new Set(sitesDemandes.map(cleSite));
      const mesBases = (bases || []).filter((b) => vises.has(cleSite(b.nom)));
      const allUsers = await sr.entities.User.list('-created_date', 500);
      teamMembers = effectifChefs(mesBases, allUsers);
      teamBaseIds = mesBases.map((b) => b.id);
      fiches = [];
    } else if (isAdmin) {
      const allBases = await sr.entities.base.list('-nom', 100);
      teamBaseIds = allBases.map((b) => b.id);
      const allUsers = await sr.entities.User.list('-created_date', 200);
      teamMembers = allUsers.filter((u) => u.app_role === 'commercial');
    } else if (estResponsableSav) {
      // Les chefs d'atelier ne figurent pas dans la structure commerciale : ils
      // sont nommés site par site dans le tableau de répartition. L'équipe d'un
      // responsable SAV, ce sont donc les chefs des sites dont il répond.
      const perimetre = await perimetreAtelier(sr, user);
      const bases = await sr.entities.base.list('nom', 500).catch(() => []);
      const mesSites = new Set((perimetre?.sites || []).map(cleSite));
      const mesBases = (bases || []).filter((b) => mesSites.has(cleSite(b.nom)));
      const allUsers = await sr.entities.User.list('-created_date', 500);
      teamMembers = effectifChefs(mesBases, allUsers);
      teamBaseIds = mesBases.map((b) => b.id);
      // Aucune fiche commerciale à conserver : l'équipe est entièrement composée
      // de comptes sans secteur.
      fiches = [];
    } else {
      // L'équipe d'un responsable vient de la structure commerciale (il en est le
      // manager), et non du rattachement à un site — jamais renseigné.
      const equipe = await perimetreResponsable(sr, user);
      fiches = equipe?.noms || [];
      const ids = new Set(equipe?.ids || []);
      const allUsers = await sr.entities.User.list('-created_date', 200);
      teamMembers = allUsers.filter((u) => ids.has(u.id));
    }

    return Response.json({
      fiches,
      // `sites` n'existe que pour les chefs d'atelier ; la page s'en sert pour
      // afficher à quel atelier chacun est rattaché.
      members: teamMembers.map((m) => ({
        id: m.id,
        full_name: m.full_name,
        email: m.email,
        base_id: m.base_id,
        user_id: m.user_id ?? m.id,
        sites: m.sites || null
      })),
      base_ids: teamBaseIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}