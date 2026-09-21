import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Appelle la fonction ; en cas de « Rate limit », patiente longuement et réessaie.
async function callStep(payload, onRateLimit) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const res = await base44.functions.invoke('generer_donnees_demo', payload);
      const data = res?.data ?? res;
      if (data?.error) {
        if (/rate limit/i.test(data.error)) { onRateLimit?.(attempt); await wait(8000); continue; }
        throw new Error(data.error);
      }
      return data;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || '';
      if (/rate limit/i.test(msg)) { onRateLimit?.(attempt); await wait(8000); continue; }
      throw e;
    }
  }
  throw new Error('Limite de débit persistante. Attendez 1 minute complète puis réessayez (sans multiplier les clics).');
}

export default function AdminDonneesDemo({ onReload }) {
  const [busy, setBusy] = useState(null); // 'gen' | 'del' | null
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Boucle de nettoyage patiente jusqu'à done
  const nettoyerTout = async () => {
    let total = 0;
    for (let i = 0; i < 80; i++) {
      const d = await callStep({ action: 'nettoyer' }, () => setStatus('Limite de débit — pause de quelques secondes…'));
      total += d.supprimes_ce_palier || 0;
      if (d.done) return total;
      setStatus(`Nettoyage des anciennes données de démo… (${d.restant} restant)`);
      await wait(2500);
    }
    throw new Error('Nettoyage trop long — relancez « Supprimer la démo ».');
  };

  // Générer = création seule (ne nettoie pas). Idempotent côté serveur : ne recrée pas si déjà présent.
  const generer = async () => {
    setBusy('gen'); setError(null); setResult(null); setStatus('Création des données de démo…');
    try {
      const d = await callStep({ action: 'creer' }, () => setStatus('Limite de débit — reprise…'));
      setResult({ action: 'creer', ...d });
      setStatus('');
      onReload?.();
    } catch (e) {
      setError(e?.message || 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const supprimer = async () => {
    if (!window.confirm("Supprimer toutes les données de démonstration (taguées « DÉMO — ») ? Cela peut prendre une à deux minutes (par petits lots).")) return;
    setBusy('del'); setError(null); setResult(null); setStatus('Suppression…');
    try {
      const total = await nettoyerTout();
      setResult({ action: 'supprimer', supprimes: total });
      setStatus('');
      onReload?.();
    } catch (e) {
      setError(e?.message || 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-5 rounded-xl border-2 border-gd-orange/30 bg-gd-orange/5 p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
        <Sparkles className="h-4 w-4 text-gd-orange" /> Mode démonstration
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Remplit l'application de données réalistes (clients, matériel, RDV, ventes, offres, badges) pour une présentation vivante.
        Données taguées <code>DÉMO —</code>, supprimables en un clic, sans toucher aux vraies données importées.
      </p>
      <div className="mb-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
        Astuce : pour des vues « par commercial » vivantes, créez d'abord les comptes de l'équipe (ci-dessous), puis générez les données.
      </div>

      <div className="flex gap-3">
        <Button onClick={generer} disabled={busy !== null} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
          {busy === 'gen' ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> En cours…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Générer les données de démo</>}
        </Button>
        <Button onClick={supprimer} disabled={busy !== null} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
          {busy === 'del' ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Suppression…</> : <><Trash2 className="h-4 w-4 mr-1.5" /> Supprimer la démo</>}
        </Button>
      </div>

      {status && <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> {status}</p>}

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> {result.action === 'supprimer' ? 'Données de démo supprimées' : result.deja_present ? 'Données de démo déjà en place' : 'Données de démo générées'}</div>
          {result.action !== 'supprimer' && !result.deja_present && (
            <p className="mt-1 text-xs">
              {result.clients} clients · {result.materiels} matériels · {result.rdv} RDV · {result.ventes} ventes · {result.offres} offres
              {typeof result.commerciaux_utilises === 'number' ? ` · ${result.commerciaux_utilises} commerciaux` : ''}
            </p>
          )}
          {result.deja_present && <p className="mt-1 text-xs">{result.clients} clients de démo déjà présents dans l'application.</p>}
          {result.supprimes != null && <p className="mt-1 text-xs">{result.supprimes} enregistrement(s) de démo supprimé(s).</p>}
          {result.note && <p className="mt-1 text-xs text-amber-700">{result.note}</p>}
        </div>
      )}
    </div>
  );
}
