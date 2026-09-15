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
    let resp;
    try {
      resp = await fetch(file_url);
    } catch (e) {
      return Response.json({ error: `Téléchargement impossible (fetch a échoué) — file_url=${String(file_url).slice(0, 140)} — ${e?.message || e}` }, { status: 500 });
    }
    if (!resp.ok) {
      return Response.json({ error: `Téléchargement du fichier échoué (HTTP ${resp.status}) — file_url=${String(file_url).slice(0, 140)}` }, { status: 500 });
    }
    const buf = await resp.arrayBuffer();

    // Parse — SheetJS détecte le séparateur (le CSV source utilise « ; »)
    let wb;
    try {
      wb = XLSX.read(buf, { type: 'array', raw: false });
    } catch (e) {
      return Response.json({ error: `Lecture du fichier impossible (format inattendu ?) — ${e?.message || e}` }, { status: 500 });
    }
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

    // Normalise les clés : retire le BOM éventuel (﻿) en tête de la 1re colonne + trim
    const rows = rawRows.map((r) => {
      const clean = {};
      for (const k in r) clean[String(k).replace(/^\uFEFF/, '').trim()] = r[k];
      return clean;
    });

    // ---- Helpers ----
    const str = (v) => {
      if (v == null) return null;
      const s = String(v).replace(/\xa0/g, ' ').trim();
      return s === '' ? null : s;
    };
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
    const parseInt10 = (v) => {
      const n = parseInt(String(v == null ? '' : v).replace(/\s/g, ''), 10);
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
    // Conserve TOUTE la donnée de possession (8 statuts) au lieu d'en perdre 5
    const normPossession = (v) => {
      const s = str(v);
      if (!s) return null;
      const k = s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const map = {
        'proprietaire': 'Propriétaire',
        'locataire': 'Locataire',
        'vendu': 'Vendu',
        'en stock': 'En stock',
        'a reprendre': 'A reprendre',
        'depot vente': 'Depot vente',
        'en commande fournisseur': 'En commande fournisseur'
      };
      return map[k] || 'Autre';
    };

    // Clients existants (siren → id)
    const existing = await base44.asServiceRole.entities.client.list('-created_date', 50000);
    const sirenMap = new Map();
    for (const c of existing) {
      if (c.siren) sirenMap.set(String(c.siren).trim(), c.id);
    }

    // Dédoublonnage clients par siren + collecte des lignes véhicules
    const clientMap = new Map();
    const vehRows = [];
    for (const r of rows) {
      const siren = String(r.siren || '').trim();
      if (!siren) continue; // on ignore les lignes sans siren (clé de rapprochement)

      if (!clientMap.has(siren)) {
        const ts = parseTypeStructure(r.identite_juridique, r.naf_code);
        clientMap.set(siren, {
          raison_sociale: str(r.societe),
          siren: siren,
          siret: str(r.siret),
          code_client: str(r.code_client),
          code_prospect: str(r.code_prospect),
          id_compte_rcu: str(r.id_compte_rcu),
          identite_juridique: str(r.identite_juridique),
          tel_mobile: str(r.tel_1),
          email: str(r.email_1),
          adresse_complete: [r.adresse, r.code_postal, r.ville].map(str).filter(Boolean).join(', ') || null,
          departement: str(r.departement),
          latitude: parseNum(r.latitude),
          longitude: parseNum(r.longitude),
          activite_naf: str(r.naf_libelle),
          naf_code: str(r.naf_code),
          filiale: str(r.filiale),
          nb_interlocuteurs: parseInt10(r.nb_interlocuteurs),
          consent_tel: str(r.consent_tel),
          consent_email: str(r.consent_email),
          consent_courrier: str(r.consent_courrier),
          type_structure: ts,
          sources_donnees: ['MISTRA', 'SIV'],
          type_client_mistra: r.type_client === 'Client' ? 'Client' : 'Prospect',
          ca_total_12m: parseNum(r['CA total']),
          ca_pieces_12m: parseNum(r['CA pièces']),
          ca_sav_12m: parseNum(r['CA SAV']),
          panier_moyen: parseNum(r['Panier moyen']),
          nb_factures: parseInt10(r['Nb factures']) || 0,
          segment_rfm: str(r['Segment RFM']),
          date_derniere_facture: parseDate(r['Date dernière facture']),
          nb_ot_ouverts: parseInt10(r['Nb OT ouverts']) || 0,
          statut: 'À contacter',
          nb_tentatives_contact: 0,
          beneficiaire_pac_certain: ts === 'CUMA' || ts === 'ETA',
          usage_pac_autorise: false,
          commerciaux_assignes: []
        });
      }
      if (r.vehicule_id) vehRows.push({ r, siren });
    }

    // Création des nouveaux clients (siren inconnu)
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

    // Création du matériel — toutes les colonnes véhicule remontent
    let materielCreated = 0;
    let batch = [];
    for (const { r, siren } of vehRows) {
      const cid = sirenMap.get(siren);
      if (!cid) continue;
      const possession = normPossession(r.vehicule_possession);
      batch.push({
        client_id: cid,
        id_vehicule: str(r.vehicule_id),
        num_plaque: str(r.vehicule_numero_plaque),
        marque: str(r.vehicule_marque),
        modele: str(r.vehicule_modele),
        premiere_immat: parseDate(r.vehicule_premiere_immat),
        heures_moteur: parseNum(r.heures_moteur),
        occasion_neuf: parseON(r.vehicule_type_vo_vn),
        combustible: str(r.vehicule_combustible),
        statut_possession: possession,
        // propriete conserve son enum strict (2 valeurs) ; le détail complet est dans statut_possession
        propriete: possession === 'Propriétaire' || possession === 'Locataire' ? possession : null,
        mode_achat: str(r.vehicule_achat),
        prix_materiel: parseNum(r['Prix du matériel']),
        famille_materiel: str(r['Famille matériel']),
        age_estime: parseInt10(r['Âge estimé']),
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
      materiel_lines: vehRows.length,
      materiel_created: materielCreated
    });
  } catch (error) {
    return Response.json({ error: `[importer_lot_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}
