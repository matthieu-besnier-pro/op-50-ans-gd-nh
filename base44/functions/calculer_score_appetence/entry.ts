import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { computeScore } from "../../shared/score.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json();
    const clientId = body.client_id;
    if (!clientId) return Response.json({ error: 'client_id requis' }, { status: 400 });

    // Service role: le calcul lit montant_pac sans l'exposer dans l'UI
    const client = await base44.asServiceRole.entities.client.get(clientId);
    if (!client) return Response.json({ error: 'Client introuvable' }, { status: 404 });

    const materiels = await base44.asServiceRole.entities.materiel.filter({ client_id: clientId }, '-created_date', 500);

    const { score, niveau } = computeScore(client, materiels);
    await base44.asServiceRole.entities.client.update(clientId, {
      score_appetence: score,
      niveau_appetence: niveau
    });

    return Response.json({ client_id: clientId, score_appetence: score, niveau_appetence: niveau });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}