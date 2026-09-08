import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import * as XLSX from 'npm:xlsx@0.18.5';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé admin' }, { status: 403 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    // Download
    const resp = await fetch(file_url);
    const buf = await resp.arrayBuffer();

    // Parse
    const wb = XLSX.read(buf, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    // Helpers
    const parseDate = (s) => {
      if (!s) return null;
      const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    };
    const parseNum = (v) => {
      if (v == null || v === '') return null;
      const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
      return isNaN(n) ? null : n;
    };
    const parseTypeStructure = (ident, naf) => {
      if (!ident || ident === 'Particulier') return 'Exploitation';
      const n = String(naf || '').trim();
      if (n === '84.11Z') return 'CUMA';
      if (n === '01.61Z') return 'ETA';
      return 'Autre société';
    };
    const parseON = (v) => {
      if (!v) return 'Inconnu';
      const s = String(v).toLowerCase();
      if (s === 'neuf') return 'Neuf';
      if (s === 'occasion') return 'Occasion';
      return 'Inconnu';
    };
    const parseProp = (v) => {
      if (!v) return null;
      const s = String(v).toLowerCase();
      if (s === 'proprietaire') return 'Propriétaire';
      if (s === 'locataire') return 'Locataire';
      return null;
    };

    // Fetch existing clients (siren → id map)
    const existing = await base44.asServiceRole.entities.client.list('-created_date', 50000);
    const sirenMap = new Map();
    for (const c of existing) {
      if (c.siren) sirenMap.set(String(c.siren).trim(), c.id);
    }

    // Deduplicate clients by siren
    const clientMap = new Map();
    const vehRows = [];
    for (const r of rows) {
      const siren = String(r.siren || '').trim();
      if (!siren) continue; // skip rows without siren

      if (!clientMap.has(siren)) {
        const ts = parseTypeStructure(r.identite_juridique, r.naf_code);
        clientMap.set(siren, {
          raison_sociale: r.societe,
          siren: siren,
          tel_mobile: r.tel_1 ? String(r.tel_1) : null,
          adresse_complete: [r.adresse, r.code_postal, r.ville].filter(Boolean).join(', '),
          latitude: parseNum(r.latitude),
          longitude: parseNum(r.longitude),
          activite_naf: r.naf_libelle || null,
          type_structure: ts,
          sources_donnees: ['MISTRA', 'SIV'],
          type_client_mistra: r.type_client === 'Client' ? 'Client' : 'Prospect',
          ca_total_12m: parseNum(r['CA total']),
          ca_pieces_12m: parseNum(r['CA pièces']),
          ca_sav_12m: parseNum(r['CA SAV']),
          panier_moyen: parseNum(r['Panier moyen']),
          nb_factures: parseInt(r['Nb factures']) || 0,
          segment_rfm: r['Segment RFM'] || null,
          date_derniere_facture: parseDate(r['Date dernière facture']),
          nb_ot_ouverts: parseInt(r['Nb OT ouverts']) || 0,
          statut: 'À contacter',
          nb_tentatives_contact: 0,
          beneficiaire_pac_certain: ts === 'CUMA' || ts === 'ETA',
          usage_pac_autorise: false,
          commerciaux_assignes: []
        });
      }
      if (r.vehicule_id) vehRows.push({ r, siren });
    }

    // Create new clients
    const newClients = [];
    for (const [siren, client] of clientMap) {
      if (!sirenMap.has(siren)) newClients.push(client);
    }

    let clientsCreated = 0;
    for (let i = 0; i < newClients.length; i += 500) {
      const batch = newClients.slice(i, i + 500);
      const created = await base44.asServiceRole.entities.client.bulkCreate(batch);
      for (const c of created) {
        if (c.siren) sirenMap.set(String(c.siren).trim(), c.id);
      }
      clientsCreated += created.length;
    }

    // Create materiel
    let materielCreated = 0;
    let batch = [];
    for (const { r, siren } of vehRows) {
      const cid = sirenMap.get(siren);
      if (!cid) continue;
      batch.push({
        client_id: cid,
        num_plaque: r.vehicule_numero_plaque || null,
        marque: r.vehicule_marque ? String(r.vehicule_marque).trim() : null,
        modele: r.vehicule_modele ? String(r.vehicule_modele).trim().replace(/\xa0/g, ' ').trim() : null,
        premiere_immat: parseDate(r.vehicule_premiere_immat),
        heures_moteur: parseNum(r.heures_moteur),
        occasion_neuf: parseON(r.vehicule_type_vo_vn),
        propriete: parseProp(r.vehicule_possession),
        prix_materiel: parseNum(r['Prix du matériel']),
        famille_materiel: r['Famille matériel'] || null,
        age_estime: parseInt(r['Âge estimé']) || null,
        commerciaux_assignes: []
      });
      if (batch.length === 500) {
        const created = await base44.asServiceRole.entities.materiel.bulkCreate(batch);
        materielCreated += created.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      const created = await base44.asServiceRole.entities.materiel.bulkCreate(batch);
      materielCreated += created.length;
    }

    return Response.json({
      total_rows: rows.length,
      unique_clients: clientMap.size,
      clients_created: clientsCreated,
      clients_skipped: clientMap.size - newClients.length,
      materiel_created: materielCreated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}