import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';

export default function AdminAffectationImport({ commerciaux, clients, onReload }) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [clientCol, setClientCol] = useState(0);
  const [commCol, setCommCol] = useState(1);
  const [matchMode, setMatchMode] = useState('siren');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    setRows([]);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) return;
      setHeaders(json[0].map((h) => String(h || '').trim()));
      setRows(json.slice(1).filter((r) => r.length > 0 && r.some((c) => c !== null && c !== '')));
      // auto-detect columns
      const sirenIdx = json[0].findIndex((h) => /siren/i.test(String(h)));
      const communeIdx = json[0].findIndex((h) => /commune/i.test(String(h)));
      const commIdx = json[0].findIndex((h) => /commercial|email|mail|commerc/i.test(String(h)));
      if (sirenIdx >= 0) { setClientCol(sirenIdx); setMatchMode('siren'); }
      else if (communeIdx >= 0) { setClientCol(communeIdx); setMatchMode('commune'); }
      if (commIdx >= 0) setCommCol(commIdx);
    } catch (e) { console.error(e); }
  };

  const process = async () => {
    setProcessing(true);
    setProgress(0);
    setResults(null);
    const stats = { assigned: 0, alreadyAssigned: 0, clientNotFound: 0, commNotFound: 0, errors: [] };

    const commByEmail = {};
    commerciaux.forEach((c) => { if (c.email) commByEmail[c.email.toLowerCase().trim()] = c; });

    let clientList = clients && clients.length > 0 ? clients : [];
    if (clientList.length === 0) {
      try { clientList = await base44.entities.client.list('-created_date', 500); } catch (e) { /* ignore */ }
    }

    const clientsBySiren = {};
    const clientsByCommune = {};
    clientList.forEach((c) => {
      if (c.siren) clientsBySiren[String(c.siren).trim()] = c;
      if (c.code_commune) {
        (clientsByCommune[c.code_commune] = clientsByCommune[c.code_commune] || []).push(c);
      }
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const clientKey = String(row[clientCol] || '').trim();
      const commEmail = String(row[commCol] || '').trim().toLowerCase();
      if (!clientKey || !commEmail) { stats.errors.push(`Ligne ${i + 2}: données manquantes`); continue; }

      const commercial = commByEmail[commEmail];
      if (!commercial) { stats.commNotFound++; continue; }

      let matchedClients = [];
      if (matchMode === 'siren') {
        const c = clientsBySiren[clientKey];
        if (c) matchedClients = [c];
      } else {
        matchedClients = clientsByCommune[clientKey] || [];
      }

      if (matchedClients.length === 0) { stats.clientNotFound++; continue; }

      for (const client of matchedClients) {
        const current = client.commerciaux_assignes || [];
        if (current.includes(commercial.id)) { stats.alreadyAssigned++; continue; }
        try {
          const updated = [...current, commercial.id];
          await base44.entities.client.update(client.id, { commerciaux_assignes: updated });
          stats.assigned++;
        } catch (e) { stats.errors.push(`${client.raison_sociale}: ${e.message || 'erreur'}`); }
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResults(stats);
    setProcessing(false);
    onReload?.();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['SIREN', 'Email commercial'],
      ['123456789', 'jean.dupont@gonnin-duris.fr'],
      ['987654321', 'marie.martin@gonnin-duris.fr']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Affectations');
    XLSX.writeFile(wb, 'modele_affectation.xlsx');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-dashed border-border p-6 text-center flex-1 mr-4">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Importer un fichier d'affectation</p>
          <p className="text-xs text-muted-foreground mt-1">CSV ou Excel · Colonne 1 : SIREN (ou code commune) · Colonne 2 : email commercial</p>
          <Button onClick={() => fileRef.current?.click()} className="mt-3 bg-gd-navy hover:bg-gd-navy-dark text-white">
            <Upload className="h-4 w-4 mr-1.5" /> Choisir un fichier
          </Button>
          {fileName && <p className="mt-2 text-xs text-emerald-600">✓ {fileName} — {rows.length} ligne(s)</p>}
        </div>
        <div className="text-right">
          <Button onClick={downloadTemplate} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
            <Download className="h-4 w-4 mr-1.5" /> Modèle Excel
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Identifier client par</label>
              <Select value={matchMode} onValueChange={setMatchMode}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="siren">SIREN</SelectItem>
                  <SelectItem value="commune">Code commune</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Colonne client</label>
              <Select value={String(clientCol)} onValueChange={(v) => setClientCol(Number(v))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Col ${i + 1}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Colonne commercial</label>
              <Select value={String(commCol)} onValueChange={(v) => setCommCol(Number(v))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Col ${i + 1}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={process} disabled={processing} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
              {processing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {progress}%</> : <><Upload className="h-4 w-4 mr-1.5" /> Lancer l'affectation</>}
            </Button>
          </div>

          {processing && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-gd-orange h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Aperçu (5 premières lignes)</div>
            <div className="divide-y divide-border">
              {rows.slice(0, 5).map((row, i) => (
                <div key={i} className="flex gap-4 px-3 py-2 text-xs">
                  <span className="text-muted-foreground w-8">L{i + 2}</span>
                  <span className="font-medium text-foreground flex-1">{row[clientCol] || '—'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground flex-1">{row[commCol] || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {results && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Résultats de l'import</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-xl font-bold text-emerald-700">{results.assigned}</p>
              <p className="text-xs text-emerald-600">Affectations</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-xl font-bold text-blue-700">{results.alreadyAssigned}</p>
              <p className="text-xs text-blue-600">Déjà assignés</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <AlertCircle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
              <p className="text-xl font-bold text-amber-700">{results.clientNotFound}</p>
              <p className="text-xs text-amber-600">Clients introuvables</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <AlertCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
              <p className="text-xl font-bold text-red-700">{results.commNotFound}</p>
              <p className="text-xs text-red-600">Commerciaux introuvables</p>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 max-h-32 overflow-y-auto">
              <p className="text-xs font-bold text-red-700 mb-1">Détail des erreurs ({results.errors.length}) :</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {results.errors.slice(0, 20).map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}