import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Vide toute la base clients (clients + matériel), par lots, avec reprise sur rate limit.
export default function AdminViderClients({ onReload }) {
  const [mot, setMot] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const vider = async () => {
    if (mot.trim().toUpperCase() !== 'VIDER') return;
    if (!window.confirm('Supprimer définitivement TOUS les clients, leur matériel, et toute l\'activité (RDV, ventes) ? Irréversible.')) return;
    setBusy(true); setError(null); setDone(false); setStatus('Suppression…');
    let total = 0;
    try {
      for (let i = 0; i < 2000; i++) {
        let d;
        try {
          const res = await base44.functions.invoke('vider_clients', {});
          d = res?.data ?? res;
          if (d?.error) throw new Error(d.error);
        } catch (e) {
          const msg = e?.response?.data?.error || e?.message || '';
          if (/rate limit/i.test(msg)) { setStatus('Limite de débit — pause…'); await wait(6000); continue; }
          throw e;
        }
        total += d.supprimes_ce_lot || 0;
        setStatus(`Suppression en cours… (${total} enregistrements supprimés)`);
        if (d.done) break;
        await wait(300);
      }
      setDone(true); setStatus(''); setMot('');
      onReload?.();
    } catch (e) {
      setError(e?.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-red-700">
        <AlertTriangle className="h-4 w-4" /> Vider la base clients
      </h3>
      <p className="text-sm text-red-800/90 mb-3">
        Supprime <strong>tous les clients, tout le matériel et toute l'activité</strong> (RDV, ventes) — y compris les données de démo. À faire avant de réimporter les nouvelles bases par secteur. Irréversible.
      </p>
      <div className="flex items-center gap-3">
        <Input value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Tapez VIDER" className="max-w-[160px]" />
        <Button onClick={vider} disabled={busy || mot.trim().toUpperCase() !== 'VIDER'} className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40">
          {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Suppression…</> : <><Trash2 className="h-4 w-4 mr-1.5" /> Vider la base</>}
        </Button>
      </div>
      {status && <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> {status}</p>}
      {error && <div className="mt-3 rounded-lg bg-red-100 p-3 text-xs text-red-800">{error}</div>}
      {done && <div className="mt-3 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Base clients vidée.</div>}
    </div>
  );
}
