import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé aux administrateurs' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Read structure_commerciale
    const structure = await base44.asServiceRole.entities.structure_commerciale.list('-nom_commercial', 100);

    const results = { commercials: [], totalClientsUpdated: 0, errors: [] };

    for (const s of structure) {
      const codes = s.codes_communes || [];
      if (codes.length === 0) {
        results.commercials.push({ nom: s.nom_commercial, id: s.id, codes: 0, clientsUpdated: 0 });
        continue;
      }

      if (dryRun) {
        // Count matching clients
        const matching = await base44.asServiceRole.entities.client.filter({ code_commune: { $in: codes } }, '-created_date', 1);
        results.commercials.push({ nom: s.nom_commercial, id: s.id, codes: codes.length, clientsMatch: matching.length });
        continue;
      }

      try {
        // Update all clients matching these codes communes — add structure_commerciale ID to commerciaux_assignes
        let totalUpdated = 0;
        let hasMore = true;
        while (hasMore) {
          const res = await base44.asServiceRole.entities.client.updateMany(
            { code_commune: { $in: codes } },
            { $addToSet: { commerciaux_assignes: s.id } }
          );
          totalUpdated += res.modified_count || res.modifiedCount || 0;
          hasMore = res.has_more === true;
        }
        results.commercials.push({ nom: s.nom_commercial, id: s.id, codes: codes.length, clientsUpdated: totalUpdated });
        results.totalClientsUpdated += totalUpdated;
      } catch (e) {
        results.errors.push(`${s.nom_commercial}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      dryRun,
      ...results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}