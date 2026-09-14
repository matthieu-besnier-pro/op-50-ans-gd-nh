import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé aux administrateurs' }, { status: 403 });

    const body = await req.json();
    const dryRun = body.dry_run === true;

    // Read structure_commerciale
    const structure = await base44.asServiceRole.entities.structure_commerciale.list('-nom_commercial', 100);
    const bases = await base44.asServiceRole.entities.base.list('-nom', 100);

    // Helper: generate demo email from name
    const makeEmail = (nom) => {
      const clean = nom.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s.]/g, '')
        .trim()
        .replace(/\s+/g, '.');
      return `${clean}@demo.gonnin-duris.fr`;
    };

    // Identify managers (unique)
    const managerNames = [...new Set(structure.map(s => s.manager).filter(Boolean))];

    const results = { managers: [], commercials: [], errors: [] };

    if (dryRun) {
      return Response.json({
        dryRun: true,
        managers: managerNames.map(n => ({ nom: n, email: makeEmail(n) })),
        commercials: structure.map(s => ({ nom: s.nom_commercial, email: makeEmail(s.nom_commercial), codes: s.codes_communes?.length || 0 }))
      });
    }

    // Get existing users
    const existingUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
    const emailToUser = {};
    existingUsers.forEach(u => { emailToUser[u.email] = u; });

    // Step 1: Create manager accounts
    const managerUserIds = {};
    for (const managerName of managerNames) {
      const email = makeEmail(managerName);
      try {
        let userId;
        if (emailToUser[email]) {
          userId = emailToUser[email].id;
        } else {
          await base44.users.inviteUser(email, 'user');
          // Re-fetch to find the new user
          await new Promise(r => setTimeout(r, 500));
          const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
          const newUser = users.find(u => u.email === email);
          if (newUser) {
            userId = newUser.id;
            emailToUser[email] = newUser;
          } else {
            results.errors.push(`Manager ${managerName}: utilisateur non trouvé après invitation`);
            continue;
          }
        }
        // Update with app_role = responsable
        await base44.asServiceRole.entities.User.update(userId, {
          app_role: 'responsable',
          full_name: managerName
        });
        managerUserIds[managerName] = userId;
        results.managers.push({ nom: managerName, email, id: userId });
      } catch (e) {
        results.errors.push(`Manager ${managerName}: ${e.message}`);
      }
    }

    // Step 2: Create commercial accounts
    for (const s of structure) {
      const email = makeEmail(s.nom_commercial);
      try {
        let userId;
        if (emailToUser[email]) {
          userId = emailToUser[email].id;
        } else {
          await base44.users.inviteUser(email, 'user');
          await new Promise(r => setTimeout(r, 500));
          const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
          const newUser = users.find(u => u.email === email);
          if (newUser) {
            userId = newUser.id;
            emailToUser[email] = newUser;
          } else {
            results.errors.push(`Commercial ${s.nom_commercial}: utilisateur non trouvé après invitation`);
            continue;
          }
        }
        // Update with app_role = commercial, codes_communes, full_name
        await base44.asServiceRole.entities.User.update(userId, {
          app_role: 'commercial',
          full_name: s.nom_commercial,
          codes_communes: s.codes_communes || []
        });
        // Link structure_commerciale to user
        await base44.asServiceRole.entities.structure_commerciale.update(s.id, {
          user_id: userId,
          statut: 'Invité',
          email: email
        });
        results.commercials.push({ nom: s.nom_commercial, email, id: userId, codes: s.codes_communes?.length || 0 });
      } catch (e) {
        results.errors.push(`Commercial ${s.nom_commercial}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      managersCreated: results.managers.length,
      commercialsCreated: results.commercials.length,
      errors: results.errors,
      managers: results.managers,
      commercials: results.commercials
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}