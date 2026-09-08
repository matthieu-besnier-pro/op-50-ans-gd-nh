import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, MapPin, Users, UserX
} from 'lucide-react';

const normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function AdminAffectationCommunesImport({ commerciaux, onReload }) {
  const [mapping, setMapping] = useState(null);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [autoApply, setAutoApply] = useState(true);
  const fileRef = useRef();

  const commByName = useMemo(() => {
    const map = {};
    commerciaux.forEach((u) => {
      if (u.full_name) map[normalize(u.full_name)] = u;
    });
    return map;
  }, [commerciaux]);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    setMapping(null);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);

      const byCommercial = {};
      json.forEach((row) => {
        const commName = String(row['Commercial'] || '').trim();
        const commune = String(row['CODE COMMUNE'] || '').trim();
        const manager = String(row['Manager'] || '').trim();
        const entite = String(row['Entité'] || '').trim();
        if (!commName || !commune) return;
        if (!byCommercial[commName]) {
          byCommercial[commName] = { communes: [], manager, entite };
        }
        if (!byCommercial[commName].communes.includes(commune)) {
          byCommercial[commName].communes.push(commune);
        }
      });

      const matched = [];
      const unmatched = [];
      Object.entries(byCommercial).forEach(([name, data]) => {
        const user = commByName[normalize(name)];
        if (user) {
          matched.push({ user, name, communes: data.communes, manager: data.manager, entite: data.entite });
        } else {
          unmatched.push({ name, communes: data.communes, manager: data.manager, entite: data.entite });
        }
      });

      matched.sort((a, b) => a.communes.length - b.communes.length);
      unmatched.sort((a, b) => a.communes.length - b.communes.length);
      setMapping({ matched, unmatched });
    } catch (e) {
      console.error(e);
    }
  };

  const apply = async () => {
    if (!mapping) return;
    setProcessing(true);
    setProgress(0);
    setResults(null);
    const stats = { usersUpdated: 0, communesApplied: 0, errors: [] };

    for (let i = 0; i < mapping.matched.length; i++) {
      const { user, communes } = mapping.matched[i];
      try {
        const existing = user.codes_communes || [];
        const merged = [...new Set([...existing, ...communes])];
        await base44.entities.User.update(user.id, { codes_communes: merged });
        stats.usersUpdated++;

        if (autoApply) {
          for (const code of communes) {
            await base44.entities.client.updateMany(
              { code_commune: code },
              { $addToSet: { commerciaux_assignes: user.id } }
            );
          }
          stats.communesApplied += communes.length;
        }
      } catch (e) {
        stats.errors.push(`${user.full_name || user.email}: ${e.message || 'erreur'}`);
      }
      setProgress(Math.round(((i + 1) / mapping.matched.length) * 100));
    }

    setResults(stats);
    setProcessing(false);
    onReload?.();
  };

  const totalCommunes = mapping
    ? mapping.matched.reduce((s, m) => s + m.communes.length, 0) +
      mapping.unmatched.reduce((s, m) => s + m.communes.length, 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-dashed border-border p-5 text-center flex-1 mr-4">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          <FileSpreadsheet className="h-9 w-9 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Importer la structure des commerciaux</p>
          <p className="text-xs text-muted-foreground mt-1">Excel · Colonnes : CODE COMMUNE, Commercial, Manager, Entité</p>
          <Button onClick={() => fileRef.current?.click()} className="mt-3 bg-gd-navy hover:bg-gd-navy-dark text-white">
            <Upload className="h-4 w-4 mr-1.5" /> Choisir le fichier
          </Button>
          {fileName && <p className="mt-2 text-xs text-emerald-600">✓ {fileName} — {totalCommunes} commune(s)</p>}
        </div>
      </div>

      {mapping && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-xl font-bold text-emerald-700">{mapping.matched.length}</p>
              <p className="text-xs text-emerald-600">Commerciaux reconnus</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <UserX className="h-5 w-5 mx-auto text-red-600 mb-1" />
              <p className="text-xl font-bold text-red-700">{mapping.unmatched.length}</p>
              <p className="text-xs text-red-600">Non reconnus</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <MapPin className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-xl font-bold text-blue-700">{totalCommunes}</p>
              <p className="text-xs text-blue-600">Codes communes</p>
            </div>
          </div>

          {/* Options + apply */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox checked={autoApply} onCheckedChange={(v) => setAutoApply(!!v)} />
              <span>Affecter automatiquement les clients existants à l'import</span>
            </label>
            <Button onClick={apply} disabled={processing || mapping.matched.length === 0} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
              {processing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {progress}%</> : <><Upload className="h-4 w-4 mr-1.5" /> Importer {mapping.matched.length} commercial(aux)</>}
            </Button>
          </div>

          {processing && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-gd-orange h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Matched list */}
          {mapping.matched.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-600" /> Commerciaux reconnus
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {mapping.matched.map((m) => (
                  <div key={m.user.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{m.user.full_name || m.user.email}</p>
                      <p className="text-muted-foreground">{m.manager} · {m.entite}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gd-navy/10 px-2 py-0.5 font-medium text-gd-navy">
                      {m.communes.length} commune(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched list */}
          {mapping.unmatched.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <UserX className="h-3.5 w-3.5 text-red-600" /> Commerciaux non reconnus (vérifiez les comptes utilisateurs)
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50/30 divide-y divide-red-100">
                {mapping.unmatched.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{m.name}</p>
                      <p className="text-muted-foreground">{m.manager} · {m.entite}</p>
                    </div>
                    <span className="shrink-0 text-red-600 font-medium">{m.communes.length} commune(s)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Résultats de l'import</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-xl font-bold text-emerald-700">{results.usersUpdated}</p>
              <p className="text-xs text-emerald-600">Commerciaux mis à jour</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <MapPin className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="text-xl font-bold text-blue-700">{results.communesApplied}</p>
              <p className="text-xs text-blue-600">Communes appliquées</p>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 max-h-32 overflow-y-auto">
              <p className="text-xs font-bold text-red-700 mb-1">Erreurs ({results.errors.length}) :</p>
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