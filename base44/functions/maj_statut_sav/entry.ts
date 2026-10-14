import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { clientDansPerimetre } from '../../shared/perimetre.ts';

// Changement de statut d'un client depuis la partie SAV, et prise de rendez-vous.
// Le RLS réserve l'écriture au commercial affecté (ou à la Direction) ; les fiches ciblées par
// l'atelier ne sont assignées à personne. On passe donc par le rôle service, après vérification
// du périmètre du demandeur : chef d'atelier de ce site, ou commercial du site.
// body = { client_id, updates } — `updates.rdv_obtenus` liste les RDV déjà obtenus sur le client.

const CHAMPS = ['statut', 'date_prochain_rdv', 'date_dernier_contact', 'date_rappel', 'motif_refus', 'nb_tentatives_contact'];
// Suivis cumulables : les rendez-vous obtenus et le suivi du contact atelier
// (le rendez-vous atelier ne se prend pas tout de suite : on marque d'abord le
// contact, puis l'accord du client). Un suivi déjà acquis n'est jamais écrasé.
const STATUTS_SUIVI = [
  'RDV Commercial obtenu',
  'RDV Atelier obtenu',
  'RDV Agri. précision obtenu',
  "Contacté par l'atelier",
  'OK pour un RDV'
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.client_id || '').trim();
    if (!id) return Response.json({ error: 'Client introuvable.' }, { status: 400 });

    const updates = {};
    CHAMPS.forEach((k) => { if (body.updates && body.updates[k] !== undefined) updates[k] = body.updates[k]; });
    // Suivis obtenus : on ne garde que les statuts connus (rendez-vous et suivi atelier).
    if (body.updates && Array.isArray(body.updates.rdv_obtenus)) {
      updates.rdv_obtenus = body.updates.rdv_obtenus.filter((s) => STATUTS_SUIVI.includes(s));
    }
    if (!updates.statut && !updates.rdv_obtenus) {
      return Response.json({ error: 'Statut manquant.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const client = await sr.entities.client.get(id).catch(() => null);
    if (!client) return Response.json({ error: 'Client introuvable.' }, { status: 404 });

    // Chef d'atelier / responsable SAV : uniquement les clients de son périmètre
    // (tableau de répartition) — la même règle que la liste.
    if (!(await clientDansPerimetre(sr, user, client))) {
      return Response.json({ error: "Ce client n'est pas dans votre périmètre SAV." }, { status: 403 });
    }

    const maj = await sr.entities.client.update(id, updates);
    return Response.json({ ok: true, client: maj });
  } catch (error) {
    return Response.json({ error: `[maj_statut_sav] ${error?.message || String(error)}` }, { status: 500 });
  }
}