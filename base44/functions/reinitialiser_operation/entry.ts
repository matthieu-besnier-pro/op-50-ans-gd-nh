import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Remet les compteurs de l'opération à zéro pour le lancement.
// - Supprime les données transactionnelles : ventes, RDV, badges obtenus, commentaires, offres magasin.
// - Réinitialise chaque client au statut « À contacter » (efface rappel, motif, devis, dates de contact).
// - NE TOUCHE PAS aux données de référence : clients (identité), matériel, structure, bases, utilisateurs, paramètres, scores, affectations.
// Mode dry_run (par défaut) : ne supprime rien, renvoie seulement les compteurs.

async function listAllIds(entity, sr) {
  const ids = [];
  let offset = 0;
  while (ids.length < 200000) {
    const batch = await sr.entities[entity].list('-created_date', 500, offset);
    if (!batch || batch.length === 0) break;
    for (const r of batch) ids.push(r.id);
    offset += batch.length;
    if (batch.length < 500) break;
  }
  return ids;
}

async function deleteAll(entity, sr) {
  const ids = await listAllIds(entity, sr);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    await Promise.all(chunk.map((id) => sr.entities[entity].delete(id).then(() => { deleted++; }).catch(() => {})));
  }
  return { total: ids.length, deleted };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const confirm = body.confirm === true;
    const caleDates = body.caler_dates_prise_rdv === true;

    const sr = base44.asServiceRole;

    // Entités transactionnelles à vider
    const ENTITES = ['vente', 'rdv', 'badge_obtenu', 'commentaire', 'offre_magasin'];

    // Compteurs actuels (aperçu)
    const counts = {};
    for (const e of ENTITES) {
      counts[e] = (await listAllIds(e, sr)).length;
    }
    const clientIds = await listAllIds('client', sr);
    counts.clients_a_reinitialiser = clientIds.length;

    if (!confirm) {
      return Response.json({ dry_run: true, counts });
    }

    // --- Exécution de la remise à zéro ---
    const supprime = {};
    for (const e of ENTITES) {
      supprime[e] = (await deleteAll(e, sr)).deleted;
    }

    // Réinitialisation des clients (par lots de 500)
    let clientsReset = 0;
    for (let i = 0; i < clientIds.length; i += 500) {
      const batch = clientIds.slice(i, i + 500).map((id) => ({
        id,
        statut: 'À contacter',
        nb_tentatives_contact: 0,
        date_rappel: null,
        motif_refus: null,
        montant_devis: null,
        date_dernier_contact: null,
        date_prochain_rdv: null
      }));
      if (batch.length > 0) {
        await sr.entities.client.bulkUpdate(batch);
        clientsReset += batch.length;
      }
    }

    // Option : caler les dates de prise de RDV sur le 13-14 octobre 2026
    let datesReglees = false;
    if (caleDates) {
      const params = await sr.entities.parametres_operation.list('-created_date', 1);
      const patch = {
        date_debut_prise_rdv: '2026-10-13',
        date_fin_prise_rdv: '2026-10-14'
      };
      if (params[0]) {
        await sr.entities.parametres_operation.update(params[0].id, patch);
      } else {
        await sr.entities.parametres_operation.create({ nom_operation: '50 ans New Holland', ...patch });
      }
      datesReglees = true;
    }

    return Response.json({
      ok: true,
      supprime,
      clients_reinitialises: clientsReset,
      dates_prise_rdv_reglees: datesReglees
    });
  } catch (error) {
    return Response.json({ error: `[reinitialiser_operation] ${error?.message || String(error)}` }, { status: 500 });
  }
}
