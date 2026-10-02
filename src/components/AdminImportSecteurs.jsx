import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Tractor, Wrench, Satellite } from 'lucide-react';

const USAGES = [
  { value: 'commerce', label: 'Commerce (immatriculations par secteur)', icon: Tractor },
  { value: 'atelier', label: 'Atelier / récolte (hivernage)', icon: Wrench },
  { value: 'agri_precision', label: 'Agriculture de précision (Trimble)', icon: Satellite }
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const str = (v) => { if (v == null) return null; const s = String(v).replace(/\xa0/g, ' ').trim(); return s === '' ? null : s; };
const sirenClean = (v) => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.slice(0, 9) : null; };
const parseDate = (v) => {
  if (v == null || v === '') return null;
  const s = String(v);
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const n = parseInt(s, 10); // série Excel
  if (!isNaN(n) && n > 20000 && n < 60000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000); return d.toISOString().slice(0, 10); }
  return null;
};
const parseON = (v) => { const s = norm(v); if (s.includes('neuf')) return 'Neuf'; if (s.includes('occ')) return 'Occasion'; return 'Inconnu'; };

function headerIndex(headerRow) {
  const m = {};
  headerRow.forEach((h, i) => { const k = norm(h); if (k && !(k in m)) m[k] = i; });
  return (row, ...keys) => {
    for (const k of keys) { const i = m[norm(k)]; if (i != null) return row[i]; }
    return undefined;
  };
}

export default function AdminImportSecteurs({ onReload }) {
  const [files, setFiles] = useState([]); // {name, usage, clients, materiels}
  const [usage, setUsage] = useState('commerce');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  // Accumulateur global dédoublonné par SIREN
  const [clientMap] = useState(() => new Map());
  const [materiels] = useState(() => []);
  const [, force] = useState(0);

  const addUsage = (c, u) => { if (!c.usages.includes(u)) c.usages.push(u); };

  const parseFile = async (file, usageSel) => {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    let nbCli = 0, nbMat = 0;

    const upsert = (siren, base, u) => {
      if (!siren) return null;
      let c = clientMap.get(siren);
      if (!c) {
        c = { raison_sociale: base.raison_sociale, siren, adresse_complete: base.adresse_complete || null, code_commune: base.code_commune || null, tel_mobile: base.tel_mobile || null, tel_fixe: base.tel_fixe || null, secteur: base.secteur || null, usages: [], statut: 'À contacter', nb_tentatives_contact: 0, sources_donnees: ['SIV'] };
        clientMap.set(siren, c); nbCli++;
      } else {
        if (!c.secteur && base.secteur) c.secteur = base.secteur;
        if (!c.adresse_complete && base.adresse_complete) c.adresse_complete = base.adresse_complete;
        if (!c.tel_mobile && base.tel_mobile) c.tel_mobile = base.tel_mobile;
      }
      addUsage(c, u);
      return c;
    };

    if (usageSel === 'agri_precision') {
      const ws = wb.Sheets['Feuil1'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) return { nbCli, nbMat };
      const get = headerIndex(rows[0]);
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const siret = str(get(row, 'Siret'));
        const siren = siret ? sirenClean(siret) : ('AP' + (str(get(row, 'Code Client Gestion')) || r));
        const raison = str(get(row, 'Raison Sociale')) || str(get(row, 'Titre Social')) || 'Client';
        const cp = str(get(row, 'Code Postal')); const ville = str(get(row, 'Ville'));
        const adr = [str(get(row, 'Adresse 1')), cp, ville].filter(Boolean).join(' ');
        upsert(siren, { raison_sociale: raison, adresse_complete: adr || null, code_commune: str(get(row, 'Code INSEE')), tel_mobile: str(get(row, 'Téléphone 1')), tel_fixe: str(get(row, 'Téléphone 2')), secteur: str(get(row, 'Secteur Commercial')) }, 'agri_precision');
        materiels.push({ _siren: siren, usage: 'agri_precision', categorie_op: 'AGRI PRECISION', secteur: str(get(row, 'Secteur Commercial')), marque: str(get(row, 'Marque')), modele: str(get(row, 'Type')), categorie_1: str(get(row, 'Catégorie Matériel (Libellé)')), occasion_neuf: parseON(get(row, "Etat d'acquisition")), annee_immat: parseInt(get(row, "Année d'Achat")) || null });
        nbMat++;
      }
    } else {
      for (const sheetName of wb.SheetNames) {
        if (norm(sheetName) === 'recap') continue;
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        // trouver la ligne d'entête (contient SIREN)
        let h = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) { if (rows[i].some((x) => norm(x) === 'siren')) { h = i; break; } }
        if (h < 0) continue;
        const get = headerIndex(rows[h]);
        const cat = sheetName;
        for (let r = h + 1; r < rows.length; r++) {
          const row = rows[r];
          const siren = sirenClean(get(row, 'SIREN'));
          if (!siren) continue;
          const secteur = str(get(row, 'Secteur vendeur'));
          upsert(siren, { raison_sociale: str(get(row, 'Client')) || 'Client', adresse_complete: str(get(row, 'Adresse')), code_commune: str(get(row, 'Code commune')), tel_mobile: str(get(row, 'Mobile')), tel_fixe: str(get(row, 'Fixe')), secteur }, usageSel);
          materiels.push({ _siren: siren, usage: usageSel, categorie_op: cat, secteur, marque: str(get(row, 'Marque')), modele: str(get(row, 'Modèle')), categorie_1: str(get(row, 'Type')), num_plaque: str(get(row, 'Plaque')), vin: str(get(row, 'VIN')), premiere_immat: parseDate(get(row, '1re immat.')), annee_immat: parseInt(get(row, 'Année immat.')) || null, occasion_neuf: parseON(get(row, 'Neuf/Occ.')) });
          nbMat++;
        }
      }
    }
    return { nbCli, nbMat };
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setStatus('Lecture du fichier…');
    try {
      const { nbMat } = await parseFile(file, usage);
      setFiles((prev) => [...prev, { name: file.name, usage, materiels: nbMat }]);
      force((x) => x + 1);
      setStatus('');
    } catch (e) {
      setError(e?.message || 'Erreur de lecture');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const totalClients = clientMap.size;
  const parUsage = { commerce: 0, atelier: 0, agri_precision: 0 };
  clientMap.forEach((c) => c.usages.forEach((u) => { parUsage[u] = (parUsage[u] || 0) + 1; }));

  const creerBase = async () => {
    if (clientMap.size === 0) return;
    setBusy(true); setError(null); setResult(null);
    try {
      // 1) Rattachement secteur -> user_id via structure_commerciale
      setStatus('Préparation des affectations…');
      const structure = await base44.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => []);
      const secteurToUser = {};
      structure.forEach((s) => { if (s.user_id && s.nom_commercial) secteurToUser[norm(s.nom_commercial)] = s.user_id; });

      const clients = [...clientMap.values()].map((c) => {
        const uid = c.secteur ? secteurToUser[norm(c.secteur)] : null;
        return { ...c, commerciaux_assignes: uid ? [uid] : [] };
      });

      // 2) Création des clients par lots → mapping siren -> id
      const sirenToId = {};
      for (let i = 0; i < clients.length; i += 400) {
        const batch = clients.slice(i, i + 400);
        setStatus(`Création des clients… ${i}/${clients.length}`);
        const res = await base44.functions.invoke('creer_clients_lot', { entity: 'client', records: batch });
        Object.assign(sirenToId, (res?.data?.map) || {});
        await new Promise((r) => setTimeout(r, 150));
      }

      // 3) Création du matériel (client_id résolu par siren)
      const mats = materiels.map((m) => ({
        client_id: sirenToId[m._siren] || null,
        marque: m.marque, modele: m.modele, categorie_1: m.categorie_1 || null,
        num_plaque: m.num_plaque || null, vin: m.vin || null,
        premiere_immat: m.premiere_immat || null, occasion_neuf: m.occasion_neuf || 'Inconnu',
        annee_immat: m.annee_immat || null, categorie_op: m.categorie_op, usage: m.usage, secteur: m.secteur || null
      })).filter((m) => m.client_id);

      let matCrees = 0;
      for (let i = 0; i < mats.length; i += 400) {
        const batch = mats.slice(i, i + 400);
        setStatus(`Création du matériel… ${i}/${mats.length}`);
        const res = await base44.functions.invoke('creer_clients_lot', { entity: 'materiel', records: batch });
        matCrees += (res?.data?.crees || batch.length);
        await new Promise((r) => setTimeout(r, 150));
      }

      setResult({ clients: clients.length, materiels: matCrees });
      setStatus('');
      clientMap.clear(); materiels.length = 0; setFiles([]);
      onReload?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur pendant la création');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4 text-gd-orange" /> Import des bases par secteur (3 usages)
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Ajoutez chaque fichier avec son usage. Les clients sont dédoublonnés par SIREN (une fiche, plusieurs usages),
        le matériel est rattaché, et le commercial est affecté par secteur. Créez ensuite la base.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Usage de ce fichier</label>
          <Select value={usage} onValueChange={setUsage}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {USAGES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
          <Upload className="h-4 w-4 mr-1.5" /> Ajouter le fichier
        </Button>
      </div>

      {status && <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> {status}</p>}
      {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="font-medium">{f.name}</span>
              <span className="text-xs text-muted-foreground">{USAGES.find((u) => u.value === f.usage)?.label} · {f.materiels} machines</span>
            </div>
          ))}
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-semibold">{totalClients} clients uniques · {materiels.length} matériels</p>
            <p className="mt-1 text-xs text-muted-foreground">Commerce : {parUsage.commerce} · Atelier : {parUsage.atelier} · Agri‑précision : {parUsage.agri_precision}</p>
          </div>
          <Button onClick={creerBase} disabled={busy} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Création…</> : <>Créer la base ({totalClients} clients)</>}
          </Button>
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Base créée : {result.clients} clients · {result.materiels} matériels.
        </div>
      )}
    </div>
  );
}
