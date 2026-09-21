import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

// Génère (ou supprime) un jeu de données de démonstration taguées « DÉMO — ».
export default function AdminDonneesDemo({ onReload }) {
  const [busy, setBusy] = useState(null); // 'gen' | 'del' | null
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const call = async (action) => {
    setBusy(action === 'supprimer' ? 'del' : 'gen'); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke('generer_donnees_demo', { action });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult({ action, ...data });
      onReload?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const generer = async () => {
    if (!window.confirm("Générer un jeu de données de démonstration ? Un éventuel jeu de démo précédent est d'abord supprimé. Les vraies données importées ne sont pas touchées.")) return;
    await call('generer');
  };
  const supprimer = async () => {
    if (!window.confirm("Supprimer toutes les données de démonstration (clients, RDV, ventes, offres taguées « DÉMO — ») ?")) return;
    await call('supprimer');
  };

  return (
    <div className="mb-5 rounded-xl border-2 border-gd-orange/30 bg-gd-orange/5 p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
        <Sparkles className="h-4 w-4 text-gd-orange" /> Mode démonstration
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Remplit l'application de données réalistes (clients, matériel, RDV, ventes, offres, badges) pour une présentation vivante —
        tableau de bord, Grand Écran, équipes et espaces commerciaux. Données taguées <code>DÉMO —</code>, supprimables en un clic,
        sans toucher aux vraies données importées.
      </p>
      <div className="mb-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
        Astuce : pour des vues « par commercial » vivantes, créez d'abord les comptes de l'équipe (ci-dessous), puis générez les données.
      </div>

      <div className="flex gap-3">
        <Button onClick={generer} disabled={busy !== null} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
          {busy === 'gen' ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Génération…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Générer les données de démo</>}
        </Button>
        <Button onClick={supprimer} disabled={busy !== null} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
          {busy === 'del' ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Suppression…</> : <><Trash2 className="h-4 w-4 mr-1.5" /> Supprimer la démo</>}
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> {result.action === 'supprimer' ? 'Données de démo supprimées' : 'Données de démo générées'}</div>
          {result.action !== 'supprimer' && (
            <p className="mt-1 text-xs">
              {result.clients} clients · {result.materiels} matériels · {result.rdv} RDV · {result.ventes} ventes · {result.offres} offres
              {typeof result.commerciaux_utilises === 'number' ? ` · ${result.commerciaux_utilises} commerciaux` : ''}
            </p>
          )}
          {result.supprimes != null && <p className="mt-1 text-xs">{result.supprimes} client(s) de démo supprimé(s).</p>}
          {result.note && <p className="mt-1 text-xs text-amber-700">{result.note}</p>}
        </div>
      )}
    </div>
  );
}
