import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { UserPlus, Eye, Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

// Déclenche la fonction creer_comptes_demo : 1 compte par commercial et par responsable,
// à partir de la table structure_commerciale. Aperçu (dry_run) avant création réelle.
export default function AdminComptesDemo({ onReload }) {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const call = async (dry) => {
    setBusy(true); setError(null); if (dry) { setResult(null); }
    try {
      const res = await base44.functions.invoke('creer_comptes_demo', { dry_run: dry });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      if (dry) setPreview(data);
      else { setResult(data); onReload?.(); }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const creer = async () => {
    if (!window.confirm("Créer un compte pour chaque commercial et responsable de la structure ? Les comptes utilisent des emails de démonstration (@demo.gonnin-duris.fr) — aucun email réel n'est envoyé. Pour les vrais accès, invitez les personnes avec leur email professionnel depuis l'onglet Utilisateurs.")) return;
    await call(false);
  };

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <UserPlus className="h-4 w-4 text-gd-orange" /> Créer les comptes de l'équipe (démo)
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Génère un compte par commercial et par responsable à partir de la structure ci-dessous, avec le bon rôle et les codes communes. Idéal pour préparer la démonstration.
      </p>

      <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Comptes de <strong>démonstration</strong> (emails <code>@demo.gonnin-duris.fr</code>, non réels). Pour la mise en production, invitez les personnes avec leur vraie adresse depuis <strong>Utilisateurs</strong> — chacune définit son propre mot de passe.</span>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => call(true)} disabled={busy} variant="outline"
          className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
          {busy && !result ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />} Aperçu
        </Button>
        <Button onClick={creer} disabled={busy || !preview}
          className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark disabled:opacity-40">
          {busy && result === null && preview ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Création…</> : <><UserPlus className="h-4 w-4 mr-1.5" /> Créer les comptes</>}
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {preview && !result && (
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <div className="bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Aperçu — {preview.managers?.length || 0} responsable(s), {preview.commercials?.length || 0} commercial(aux)
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border text-xs">
            {(preview.managers || []).map((m, i) => (
              <div key={`m${i}`} className="flex justify-between px-3 py-1.5">
                <span className="font-medium">{m.nom} <span className="ml-1 rounded bg-blue-100 px-1.5 text-blue-700">Responsable</span></span>
                <span className="text-muted-foreground">{m.email}</span>
              </div>
            ))}
            {(preview.commercials || []).map((c, i) => (
              <div key={`c${i}`} className="flex justify-between px-3 py-1.5">
                <span>{c.nom} <span className="ml-1 rounded bg-emerald-100 px-1.5 text-emerald-700">Commercial</span></span>
                <span className="text-muted-foreground">{c.email} · {c.codes} communes</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Comptes créés</div>
          <p className="mt-1 text-xs">Responsables : {result.managersCreated ?? 0} · Commerciaux : {result.commercialsCreated ?? 0}</p>
          {result.errors?.length > 0 && (
            <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
              <p className="font-bold">{result.errors.length} erreur(s) :</p>
              <ul className="space-y-0.5">{result.errors.slice(0, 15).map((e, i) => <li key={i}>• {e}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
