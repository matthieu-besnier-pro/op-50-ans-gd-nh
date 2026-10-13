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
// Catégories canoniques utilisées par les pictogrammes : les noms d'onglets Excel sont alignés dessus.
// « MAV » = machines à vendanger : l'onglet peut aussi s'appeler « Vendange » ou porter la
// marque (Braud), on le reconnaît dans tous les cas.
const canonCategorie = (nom) => {
  const n = norm(nom);
  if (n.includes('precision')) return 'AGRI PRECISION';
  if (n.startsWith('tract')) return 'TRACTEURS';
  if (n.startsWith('telesc')) return 'TELESCOPIQUES';
  if (n.startsWith('ensil')) return 'ENSILEUSES';
  if (n.startsWith('mav') || n.includes('vendang') || n.includes('braud')) return 'MAV';
  if (n.startsWith('mb')) return 'MB';
  if (n.includes('bb') || n.includes('rb') || n.includes('presse')) return 'BB-RB';
  return 'AUTRES';
};

// Colonne d'identification d'une ligne : SIREN ou SIRET, quels que soient les mots ajoutés
// autour par le fichier (« N° SIREN client », « Siret »…).
const cleIdent = (v) => {
  const k = norm(v);
  return k.includes('siren') ? 'siren' : (k.includes('siret') ? 'siret' : null);
};

// Clé saisie à la main sur une ligne ajoutée au fichier (prospect créé par le commercial,
// souvent préfixé « AJ ») : on la conserve telle quelle au lieu d'écarter la ligne.
const cleManuelle = (v) => {
  const s = str(v);
  if (!s) return null;
  const k = norm(s);
  if (!k || k.startsWith('total') || k.startsWith('recap')) return null;
  return s.toUpperCase().slice(0, 40);
};

// Tous les clients présents dans les fichiers sont importés, tous départements confondus.
// Le fichier PAC reste un bonus (montant perçu / appétence) : il ne conditionne plus l'import.
const deptOf = (codeInsee, fallback) => {
  const s = String(codeInsee || '').trim();
  if (s.length >= 2) return s.slice(0, 2);
  const m = String(fallback || '').match(/(\d{5})/);
  return m ? m[1].slice(0, 2) : '';
};

function headerIndex(headerRow) {
  const m = {};
  headerRow.forEach((h, i) => { const k = norm(h); if (k && !(k in m)) m[k] = i; });
  // Colonne d'identification nommée autrement : elle est lue comme SIREN / SIRET.
  headerRow.forEach((h, i) => {
    const c = cleIdent(h);
    if (c && m[c] == null) m[c] = i;
  });
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
    const feuillesIgnorees = []; // feuilles dont l'entête (colonne SIREN / SIRET) n'a pas été trouvée
    let lignesIgnorees = 0;      // lignes de machines sans client identifiable

    const upsert = (siren, base, u) => {
      if (!siren) return null;
      let c = clientMap.get(siren);
      if (!c) {
        c = { raison_sociale: base.raison_sociale, siren, adresse_complete: base.adresse_complete || null, code_commune: base.code_commune || null, departement: base.departement || null, tel_mobile: base.tel_mobile || null, tel_fixe: base.tel_fixe || null, secteur: base.secteur || null, usages: [], priorite_commercial: false, statut: 'À contacter', nb_tentatives_contact: 0, sources_donnees: ['SIV'] };
        clientMap.set(siren, c); nbCli++;
      } else {
        if (!c.secteur && base.secteur) c.secteur = base.secteur;
        if (!c.adresse_complete && base.adresse_complete) c.adresse_complete = base.adresse_complete;
        if (!c.tel_mobile && base.tel_mobile) c.tel_mobile = base.tel_mobile;
      }
      if (base.priorite) c.priorite_commercial = true; // cible choisie par le commercial
      addUsage(c, u);
      return c;
    };

    if (usageSel === 'agri_precision') {
      const ws = wb.Sheets['Feuil1'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) return { nbCli, nbMat, feuillesIgnorees, lignesIgnorees };
      const get = headerIndex(rows[0]);
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const siret = str(get(row, 'Siret'));
        const siren = siret ? sirenClean(siret) : ('AP' + (str(get(row, 'Code Client Gestion')) || r));
        const raison = str(get(row, 'Raison Sociale')) || str(get(row, 'Titre Social')) || 'Client';
        const cp = str(get(row, 'Code Postal')); const ville = str(get(row, 'Ville'));
        const adr = [str(get(row, 'Adresse 1')), cp, ville].filter(Boolean).join(' ');
        const insee = str(get(row, 'Code INSEE'));
        const dept = deptOf(insee, cp);
        upsert(siren, { raison_sociale: raison, adresse_complete: adr || null, code_commune: insee, departement: dept, tel_mobile: str(get(row, 'Téléphone 1')), tel_fixe: str(get(row, 'Téléphone 2')), secteur: str(get(row, 'Secteur Commercial')) }, 'agri_precision');
        materiels.push({ _siren: siren, usage: 'agri_precision', categorie_op: 'AGRI PRECISION', secteur: str(get(row, 'Secteur Commercial')), marque: str(get(row, 'Marque')), modele: str(get(row, 'Type')), categorie_1: str(get(row, 'Catégorie Matériel (Libellé)')), occasion_neuf: parseON(get(row, "Etat d'acquisition")), annee_immat: parseInt(get(row, "Année d'Achat")) || null });
        nbMat++;
      }
    } else {
      for (const sheetName of wb.SheetNames) {
        if (norm(sheetName) === 'recap') continue;
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        // Ligne d'entête : celle qui porte la colonne d'identification (SIREN ou SIRET),
        // même nommée autrement (« N° SIREN client »…). Si aucune n'est trouvée, la
        // feuille est signalée au lieu d'être écartée en silence.
        let h = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) { if (rows[i].some((x) => cleIdent(x))) { h = i; break; } }
        if (h < 0) { feuillesIgnorees.push(sheetName); continue; }
        const get = headerIndex(rows[h]);
        const cat = sheetName;
        // Beaucoup de fichiers n'écrivent la clé client que sur la 1re ligne du bloc :
        // les lignes suivantes (machines supplémentaires, ajouts à la main) reprennent
        // la clé précédente — sans ça, leurs machines disparaissaient de l'import.
        let cleCourante = null;
        let prioCourante = false;
        for (let r = h + 1; r < rows.length; r++) {
          const row = rows[r];
          const marque = str(get(row, 'Marque')); const modele = str(get(row, 'Modèle'));
          const plaque = str(get(row, 'Plaque')); const vin = str(get(row, 'VIN'));
          const immat = parseDate(get(row, '1re immat.'));
          const typeMachine = str(get(row, 'Type'));
          const aMachine = !!(marque || modele || plaque || vin || immat || typeMachine);
          const sirenRaw = str(get(row, 'SIREN', 'SIRET'));
          // SIREN/SIRET (9 chiffres, ou les 9 premiers d'un SIRET) ; sinon la clé saisie à la main.
          const sirenBrut = sirenRaw ? sirenClean(sirenRaw) : null;
          const cle = (sirenBrut && sirenBrut.length >= 8) ? sirenBrut : cleManuelle(sirenRaw);
          const siren = cle || (aMachine ? cleCourante : null);
          if (!siren) { if (aMachine) lignesIgnorees += 1; continue; }
          if (cle) {
            cleCourante = cle;
            prioCourante = norm(get(row, 'Priorité', 'Priorite')) === 'oui';
          }
          const secteur = str(get(row, 'Secteur vendeur'));
          const insee = str(get(row, 'Code commune'));
          const dept = deptOf(insee, str(get(row, 'Adresse')));
          const prio = prioCourante;
          upsert(siren, { raison_sociale: str(get(row, 'Client')) || 'Client', adresse_complete: str(get(row, 'Adresse')), code_commune: insee, departement: dept, tel_mobile: str(get(row, 'Mobile')), tel_fixe: str(get(row, 'Fixe')), secteur, priorite: prio }, usageSel);
          // On ne crée pas de matériel « vide » (prospect ajouté sans aucune machine).
          // En revanche, une ligne ajoutée à la main qui ne précise que le type
          // (« Tracteur agricole », ou parfois la marque saisie dans cette colonne)
          // désigne bien une machine : l'onglet donne la catégorie, ça suffit.
          if (aMachine) {
            materiels.push({ _siren: siren, usage: usageSel, categorie_op: canonCategorie(cat), secteur, priorite: prio, marque, modele, categorie_1: typeMachine, num_plaque: plaque, vin, premiere_immat: immat, annee_immat: parseInt(get(row, 'Année immat.')) || null, occasion_neuf: parseON(get(row, 'Neuf/Occ.')) });
            nbMat++;
          }
        }
      }
    }
    return { nbCli, nbMat, feuillesIgnorees, lignesIgnorees };
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setStatus('Lecture du fichier…');
    try {
      const { nbMat, feuillesIgnorees: ign, lignesIgnorees: li } = await parseFile(file, usage);
      setFiles((prev) => [...prev, { name: file.name, usage, materiels: nbMat, feuillesIgnorees: ign, lignesIgnorees: li }]);
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
  const feuillesIgnoreesTotal = files.flatMap((f) => f.feuillesIgnorees || []);
  const lignesIgnoreesTotal = files.reduce((n, f) => n + (f.lignesIgnorees || 0), 0);
  const parUsage = { commerce: 0, atelier: 0, agri_precision: 0 };
  clientMap.forEach((c) => c.usages.forEach((u) => { parUsage[u] = (parUsage[u] || 0) + 1; }));

  const creerBase = async () => {
    if (clientMap.size === 0) return;
    setBusy(true); setError(null); setResult(null);
    try {
      // 1) Rattachement secteur -> user_id via structure_commerciale
      setStatus('Préparation des affectations…');
      const structure = await base44.entities.structure_commerciale.list('-nom_commercial', 500).catch(() => []);
      // Rattachement insensible à l'ordre prénom/nom et aux accents.
      const sortTokens = (s) => norm(s).split(' ').filter(Boolean).sort().join(' ');
      const secteurToUser = {};
      structure.forEach((s) => {
        if (s.user_id && s.nom_commercial) {
          secteurToUser[norm(s.nom_commercial)] = s.user_id;
          secteurToUser[sortTokens(s.nom_commercial)] = s.user_id;
        }
      });
      const matchUser = (secteur) => secteur ? (secteurToUser[norm(secteur)] || secteurToUser[sortTokens(secteur)] || null) : null;

      const clients = [...clientMap.values()].map((c) => {
        const uid = matchUser(c.secteur);
        // Le parc (total + répartition par catégorie) est calculé côté serveur depuis la
        // base, après le rattachement des machines : il reste juste même si l'import est
        // relancé, et il tient compte des machines déjà présentes pour ce client.
        return { ...c, commerciaux_assignes: uid ? [uid] : [] };
      });

      // 2) Création des clients par lots → mapping siren -> id
      const sirenToId = {};
      let cliReutilises = 0;
      for (let i = 0; i < clients.length; i += 400) {
        const batch = clients.slice(i, i + 400);
        setStatus(`Création des clients… ${i}/${clients.length}`);
        const res = await base44.functions.invoke('creer_clients_lot', { entity: 'client', records: batch });
        Object.assign(sirenToId, (res?.data?.map) || {});
        cliReutilises += (res?.data?.reutilises || 0);
        await new Promise((r) => setTimeout(r, 150));
      }

      // 3) Création du matériel (client_id résolu par siren)
      const mats = materiels.map((m) => ({
        client_id: sirenToId[m._siren] || null,
        marque: m.marque, modele: m.modele, categorie_1: m.categorie_1 || null,
        num_plaque: m.num_plaque || null, vin: m.vin || null,
        premiere_immat: m.premiere_immat || null, occasion_neuf: m.occasion_neuf || 'Inconnu',
        annee_immat: m.annee_immat || null, categorie_op: m.categorie_op, usage: m.usage, secteur: m.secteur || null,
        priorite: m.priorite || false
      })).filter((m) => m.client_id);

      let matCrees = 0, matDejaPresents = 0;
      for (let i = 0; i < mats.length; i += 400) {
        const batch = mats.slice(i, i + 400);
        setStatus(`Rattachement du matériel… ${i}/${mats.length}`);
        const res = await base44.functions.invoke('creer_clients_lot', { entity: 'materiel', records: batch });
        matCrees += (res?.data?.crees || batch.length);
        matDejaPresents += (res?.data?.ignores || 0);
        await new Promise((r) => setTimeout(r, 150));
      }

      setResult({ clients: clients.length, reutilises: cliReutilises, materiels: matCrees, dejaPresents: matDejaPresents });
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
        Ajoutez chaque fichier avec son usage. Toutes les feuilles sont lues (TRACTEURS, MB, BB‑RB,
        TÉLESCOPIQUES, ENSILEUSES, MAV / machines à vendanger…) ; toute feuille ou ligne écartée est signalée.
        Les clients sont dédoublonnés par SIREN (une fiche, plusieurs usages), le matériel est rattaché,
        et le commercial est affecté par secteur. Créez ensuite la base : l'import peut être relancé sans
        créer de doublons, il complète les fiches déjà présentes.
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
              <span className="text-xs text-muted-foreground">
                {USAGES.find((u) => u.value === f.usage)?.label} · {f.materiels} machines
                {(f.feuillesIgnorees?.length > 0) ? ` · ${f.feuillesIgnorees.length} feuille(s) non lue(s)` : ''}
                {f.lignesIgnorees > 0 ? ` · ${f.lignesIgnorees} ligne(s) sans clé client` : ''}
              </span>
            </div>
          ))}
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-semibold">{totalClients} clients uniques · {materiels.length} matériels</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tous les clients des fichiers sont importés. Le fichier PAC sert uniquement de bonus (montant perçu et appétence).
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Commerce : {parUsage.commerce} · Atelier : {parUsage.atelier} · Agri‑précision : {parUsage.agri_precision}</p>
            {(feuillesIgnoreesTotal.length > 0 || lignesIgnoreesTotal > 0) && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                {feuillesIgnoreesTotal.length > 0 && `Feuille(s) non lue(s), entête SIREN introuvable : ${feuillesIgnoreesTotal.join(', ')}. `}
                {lignesIgnoreesTotal > 0 && `${lignesIgnoreesTotal} ligne(s) de matériel sans client identifiable : elles n'ont pas été importées.`}
              </p>
            )}
          </div>
          <Button onClick={creerBase} disabled={busy} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Création…</> : <>Créer la base ({totalClients} clients)</>}
          </Button>
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Base mise à jour : {result.clients} clients
          {result.reutilises > 0 ? ` (dont ${result.reutilises} fiches déjà présentes, complétées)` : ''} · {result.materiels} matériels rattachés
          {result.dejaPresents > 0 ? ` (${result.dejaPresents} déjà présents)` : ''}.
        </div>
      )}
    </div>
  );
}