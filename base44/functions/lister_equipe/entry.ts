import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Renvoie les membres de l'équipe du responsable connecté (ou toute l'équipe pour la Direction).
// Les non-admins ne peuvent pas lister les utilisateurs via le SDK client — d'où cette fonction en service role.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const sr = base44.asServiceRole;
    const appRole = user.app_role || 'collaborateur';
    const isAdmin = user.role === 'admin' || appRole === 'direction';

    if (!isAdmin && appRole !== 'responsable') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 });
    }

    let teamBaseIds = [];
    let teamMembers = [];

    if (isAdmin) {
      const allBases = await sr.entities.base.list('-nom', 100);
      teamBaseIds = allBases.map((b) => b.id);
      const allUsers = await sr.entities.User.list('-created_date', 200);
      teamMembers = allUsers.filter((u) => u.app_role === 'commercial');
    } else {
      const myBases = await sr.entities.base.filter({ responsable_id: user.id }, '-nom', 100);
      teamBaseIds = myBases.map((b) => b.id);
      const allUsers = await sr.entities.User.list('-created_date', 200);
      teamMembers = allUsers.filter((u) => u.app_role === 'commercial' && teamBaseIds.includes(u.base_id));
    }

    return Response.json({
      members: teamMembers.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email, base_id: m.base_id })),
      base_ids: teamBaseIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}