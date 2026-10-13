import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { perimetreResponsable, perimetreCommercial, estDansPerimetre } from '../../shared/perimetre.ts';

// Export des clients TRAVAILLÉS : ceux qui ont quitté le statut « À contacter ».
// C'est la trace de l'activité de l'opération — complément de l'export des RDV.
//
// Portée : Direction/admin = tout · Responsable = son équipe · sinon = les siens.
// body.tous = true     → exporte aussi les clients encore « À contacter ».
// body.statuts = [...]  → exporte exactement ces statuts, et eux seuls.

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

    const [clients, rdvs, users, structure] = await Promise.all([
      lireTout((skip) => sr.entities.client.list('id', CHUNK, skip)),
      lireTout((skip) => sr.entities.rdv.list('id', CHUNK, skip)),
      sr.entities.User.list('-created_date', 500).catch(() => []),
      sr.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => [])
    ]);

    const nom = {};
    users.forEach((u) => { nom[u.id] = u.full_name || u.email || ''; });
    structure.forEach((s) => { if (s.user_id && !nom[s.user_id]) nom[s.user_id] = s.nom_commercial || ''; });

    // Rendez-vous retenus par client (les annulés ne comptent pas).
    const rdvParClient = {};
    rdvs.forEach((r) => {
      if (!r.client_id || r.statut === 'Annulé') return;
      (rdvParClient[r.client_id] = rdvParClient[r.client_id] || []).push(r);
    });

    let liste = clients;
    if (!estDirection) {
      // base_responsable_id n'a jamais été renseigné à l'import : un responsable
      // exportait un fichier vide. On reprend le périmètre qui sert déjà à la
      // liste des clients — équipe via le manager des fiches, sinon assignation
      // ou secteur.
      const perimetre = estResponsable
        ? await perimetreResponsable(sr, user)
        : await perimetreCommercial(sr, user);
      liste = perimetre
        ? clients.filter(estDansPerimetre(perimetre))
        : clients.filter((c) => (c.commerciaux_assignes || []).includes(user.id));
    }

    // Choix des statuts. Par défaut : tout SAUF « À contacter », c'est-à-dire
    // les clients travaillés. Une sélection explicite prime ; body.tous n'exclut
    // rien du tout.
    const voulus = Array.isArray(body.statuts) ? body.statuts.filter(Boolean) : [];
    if (voulus.length > 0) {
      const retenus = new Set(voulus);
      liste = liste.filter((c) => retenus.has(c.statut || 'À contacter'));
    } else if (!body.tous) {
      liste = liste.filter((c) => (c.statut || 'À contacter') !== 'À contacter');
    }

    liste.sort((a, b) => String(b.date_dernier_contact || '').localeCompare(String(a.date_dernier_contact || '')));

    const lignes = liste.map((c) => {
      const mesRdv = (rdvParClient[c.id] || []).slice().sort((a, b) => String(a.date_heure).localeCompare(String(b.date_heure)));
      const prochain = mesRdv.find((r) => r.statut !== 'Réalisé');
      return {
        client: c.raison_sociale || '',
        siren: c.siren || '',
        statut: c.statut || '',
        date_dernier_contact: c.date_dernier_contact || '',
        date_rappel: c.date_rappel || '',
        motif_refus: c.motif_refus || '',
        montant_devis: c.montant_devis != null ? c.montant_devis : '',
        nb_tentatives: c.nb_tentatives_contact || 0,
        nb_rdv: mesRdv.length,
        prochain_rdv: prochain?.date_heure ? prochain.date_heure.slice(0, 16).replace('T', ' ') : '',
        cible_prioritaire: c.priorite_commercial ? 'OUI' : '',
        commercial: (c.commerciaux_assignes || []).map((id) => nom[id]).filter(Boolean).join(', ') || c.secteur || '',
        secteur: c.secteur || '',
        departement: c.departement || '',
        adresse: c.adresse_complete || '',
        tel_mobile: c.tel_mobile || '',
        parc_total: c.parc_total || 0,
        usages: (c.usages || []).join(' / '),
        agri_precision: (c.sources_agri_precision || []).join(' / ')
      };
    });

    return Response.json({ ok: true, total: lignes.length, lignes, exporte_le: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: `[exporter_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}
