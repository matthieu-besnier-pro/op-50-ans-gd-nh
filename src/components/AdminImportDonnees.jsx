import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, FileCode2, CheckCircle2, AlertCircle, Loader2, Users, Tractor, Euro } from 'lucide-react';

// Upload d'un fichier vers le stockage Base44 → renvoie file_url
async function uploadFile(file) {
  const res = await base44.integrations.Core.UploadFile({ file });
  const url = res?.file_url || res?.data?.file_url;
  if (!url) throw new Error("Upload échoué (file_url manquant)");
  return url;
}

function ResultCard({ icon: Icon, value, label, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700'
  };
  return (
    <div className={`rounded-lg p-3 text-center ${tones[tone]}`}>
      <Icon className="h-5 w-5 mx-auto mb-1 opacity-80" />
      <p className="text-xl font-bold">{value ?? 0}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

export default function AdminImportDonnees({ onReload }) {
  // Étape 1 : clients + matériel
  const [clientsFile, setClientsFile] = useState(null);
  const [clientsBusy, setClientsBusy] = useState(false);
  const [clientsRes, setClientsRes] = useState(null);
  const [clientsErr, setClientsErr] = useState(null);
  const clientsRef = useRef();

  // Étape 2 : PAC
  const [pacFile, setPacFile] = useState(null);
  const [pacBusy, setPacBusy] = useState(false);
  const [pacRes, setPacRes] = useState(null);
  const [pacErr, setPacErr] = useState(null);
  const pacRef = useRef();

  const runClients = async () => {
    if (!clientsFile) return;
    setClientsBusy(true); setClientsErr(null); setClientsRes(null);
    try {
      const file_url = await uploadFile(clientsFile);
      const res = await base44.functions.invoke('importer_lot_clients', { file_url });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setClientsRes(data);
      onReload?.();
    } catch (e) {
      setClientsErr(e?.message || "Erreur pendant l'import");
    } finally {
      setClientsBusy(false);
    }
  };

  const runPac = async () => {
    if (!pacFile) return;
    setPacBusy(true); setPacErr(null); setPacRes(null);
    try {
      const file_url = await uploadFile(pacFile);
      const res = await base44.functions.invoke('importer_pac', { file_url });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setPacRes(data);
      onReload?.();
    } catch (e) {
      setPacErr(e?.message || "Erreur pendant l'import PAC");
    } finally {
      setPacBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ÉTAPE 1 — Clients & matériel */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gd-navy text-white text-xs font-bold">1</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-gd-orange" /> Clients & matériel (export MISTRA / SIV)
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Fichier <code className="text-xs">entreprises_vehicules…csv</code>. Crée les clients (dédoublonnés par SIREN) et
          leur parc matériel. Toutes les colonnes sont reprises. Un client déjà présent n'est pas dupliqué.
        </p>
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <input ref={clientsRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => { setClientsFile(e.target.files[0]); setClientsRes(null); setClientsErr(null); }} />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <Button onClick={() => clientsRef.current?.click()} variant="outline"
            className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
            Choisir le fichier CSV
          </Button>
          {clientsFile && <p className="mt-2 text-xs text-emerald-600">✓ {clientsFile.name}</p>}
        </div>
        <Button onClick={runClients} disabled={!clientsFile || clientsBusy}
          className="mt-3 bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
          {clientsBusy
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Import en cours…</>
            : <><Upload className="h-4 w-4 mr-1.5" /> Lancer l'import clients & matériel</>}
        </Button>
        {clientsBusy && <p className="mt-2 text-xs text-muted-foreground">Traitement de plusieurs milliers de lignes, cela peut prendre un moment. Ne fermez pas la page.</p>}
        {clientsErr && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {clientsErr}
          </div>
        )}
        {clientsRes && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultCard icon={Users} value={clientsRes.clients_created} label="Clients créés" tone="emerald" />
            <ResultCard icon={CheckCircle2} value={clientsRes.clients_skipped} label="Déjà présents" tone="blue" />
            <ResultCard icon={Tractor} value={clientsRes.materiel_created} label="Matériels créés" tone="emerald" />
            <ResultCard icon={FileSpreadsheet} value={clientsRes.total_rows} label="Lignes lues" tone="slate" />
          </div>
        )}
      </div>

      {/* ÉTAPE 2 — PAC */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gd-navy text-white text-xs font-bold">2</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-gd-orange" /> Montants PAC (dashboard HTML)
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Fichier <code className="text-xs">PAC_dashboard…html</code>. Rapproche par SIREN, renseigne le montant PAC et
          recalcule le score d'appétence. <strong>À lancer après l'étape 1.</strong>
        </p>
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <input ref={pacRef} type="file" accept=".html,.htm" className="hidden"
            onChange={(e) => { setPacFile(e.target.files[0]); setPacRes(null); setPacErr(null); }} />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <Button onClick={() => pacRef.current?.click()} variant="outline"
            className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
            Choisir le fichier HTML
          </Button>
          {pacFile && <p className="mt-2 text-xs text-emerald-600">✓ {pacFile.name}</p>}
        </div>
        <Button onClick={runPac} disabled={!pacFile || pacBusy}
          className="mt-3 bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
          {pacBusy
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Import en cours…</>
            : <><Upload className="h-4 w-4 mr-1.5" /> Lancer l'import PAC</>}
        </Button>
        {pacErr && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {pacErr}
          </div>
        )}
        {pacRes && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultCard icon={Euro} value={pacRes.clients_matched_pac} label="Clients avec PAC" tone="emerald" />
            <ResultCard icon={CheckCircle2} value={pacRes.clients_updated} label="Clients mis à jour" tone="blue" />
            <ResultCard icon={FileCode2} value={pacRes.pac_records} label="Lignes PAC" tone="slate" />
            <ResultCard icon={Users} value={pacRes.total_clients} label="Clients total" tone="slate" />
          </div>
        )}
      </div>
    </div>
  );
}
