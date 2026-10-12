import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Export des rendez-vous pour sauvegarde : renvoie TOUS les RDV du périmètre
// de l'utilisateur, enrichis du client et du commercial (le navigateur n'a plus
// qu'à les mettre en CSV). Lecture seule.
//
// Portée : Direction/admin = tout · Responsable = son équipe · sinon = les siens.
// body.inclure_annules = true  → garde aussi les rendez-vous annulés.

const CHUNK = 5000;

async function lireTout(fetchPage) {
  const out = [];
  const vus = new Set();
  for (let i = 0; i < 20; i++) {
    const page = await fetchPage(i * CHUNK);
    if (!Array.isArray(page) || page.length === 0) break;
    let nouveaux = 0;
    page.forEach((r) => { if (!vus.has(r.id)) { vus.add(r.id); out.push(r); nouveaux += 1; } });
    if (page.length < CHUNK || nouveaux === 0) break;
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;

    const estDirection = user.role === 'admin' || user.app_role === 'direction';
    const estResponsable = user.app_role === 'responsable';

    const [rdvs, clients, users, structure] = await Promise.all([
      lireTout((skip) => sr.entities.rdv.list('id', CHUNK, skip)),
      lireTout((skip) => sr.entities.client.list('id', CHUNK, skip)),
      sr.entities.User.list('-created_date', 500).catch(() => []),
      sr.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => [])
    ]);

    // Nom affichable d'un commercial : compte utilisateur, sinon fiche structure.
    const nom = {};
    users.forEach((u) => { nom[u.id] = u.full_name || u.email || ''; });
    structure.forEach((s) => { if (s.user_id && !nom[s.user_id]) nom[s.user_id] = s.nom_commercial || ''; });

    const parClient = {};
    clients.forEach((c) => { parClient[c.id] = c; });

    let liste = rdvs;
    if (!estDirection) {
      liste = estResponsable
        ? rdvs.filter((r) => r.base_responsable_id === user.id)
        : rdvs.filter((r) => r.commercial_id === user.id);
    }
    if (!body.inclure_annules) liste = liste.filter((r) => r.statut !== 'Annulé');

    liste.sort((a, b) => String(a.date_heure || '').localeCompare(String(b.date_heure || '')));

    const lignes = liste.map((r) => {
      const c = parClient[r.client_id] || {};
      const d = r.date_heure ? new Date(r.date_heure) : null;
      return {
        date: d ? d.toISOString().slice(0, 10) : '',
        heure: d ? r.date_heure.slice(11, 16) : '',
        type: r.type || '',
        statut: r.statut || '',
        duree_minutes: r.duree_minutes || '',
        client: c.raison_sociale || '',
        siren: c.siren || '',
        adresse: c.adresse_complete || '',
        departement: c.departement || '',
        tel_mobile: c.tel_mobile || '',
        statut_client: c.statut || '',
        cible_prioritaire: c.priorite_commercial ? 'OUI' : '',
        commercial: nom[r.commercial_id] || r.commercial_id || '',
        secteur: c.secteur || '',
        notes: (r.notes || '').replace(/[\r\n]+/g, ' ')
      };
    });

    return Response.json({ ok: true, total: lignes.length, lignes, exporte_le: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: `[exporter_rdv] ${error?.message || String(error)}` }, { status: 500 });
  }
}
