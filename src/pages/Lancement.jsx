import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isDirection } from '@/lib/permissions';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rocket, AlertTriangle, Loader2, CheckCircle2, ShoppingBag, Calendar, Award, MessageSquare, Store, Users, RefreshCw } from 'lucide-react';

const CIBLE = '2026-10-13T00:00:00';
const MOT_CLE = 'LANCER';

function joursAvant(dateStr) {
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

function StatLine({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-foreground"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</span>
      <span className="text-lg font-bold text-foreground">{value ?? '—'}</span>
    </div>
  );
}

export default function Lancement() {
  const { user, viewAsRole } = useAuth();
  const autorise = isDirection(user, viewAsRole);

  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mot, setMot] = useState('');
  const [calerDates, setCalerDates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const chargerApercu = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke('reinitialiser_operation', { confirm: false });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setCounts(data.counts);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (autorise) chargerApercu(); }, [autorise]);

  const lancer = async () => {
    if (mot.trim().toUpperCase() !== MOT_CLE) return;
    if (!window.confirm("Confirmer la remise à zéro ? Les ventes, RDV, badges, commentaires et offres seront définitivement supprimés, et tous les clients repasseront à « À contacter ». Cette action est irréversible.")) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke('reinitialiser_operation', { confirm: true, caler_dates_prise_rdv: calerDates });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setMot('');
      await chargerApercu();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur pendant la remise à zéro');
    } finally {
      setBusy(false);
    }
  };

  if (!autorise) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">Cette page est réservée à la Direction / Marketing.</div>
      </Layout>
    );
  }

  const jours = joursAvant(CIBLE);
  const pret = mot.trim().toUpperCase() === MOT_CLE && !busy;

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        {/* En-tête / compte à rebours */}
        <div className="rounded-2xl border border-border bg-gd-navy text-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-gd-orange" />
            <div>
              <h1 className="text-xl font-bold">Lancement de l'opération</h1>
              <p className="text-sm text-white/70">Repartir d'une base propre pour le jour J.</p>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl font-black text-gd-orange">{jours > 0 ? `J−${jours}` : jours === 0 ? "Jour J" : `J+${Math.abs(jours)}`}</span>
            <span className="text-sm text-white/70">avant le 13 octobre 2026 (prise de RDV)</span>
          </div>
        </div>

        {/* Aperçu */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ce qui sera remis à zéro</h2>
            <Button variant="ghost" size="sm" onClick={chargerApercu} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {loading ? (
            <div className="py-6 text-center text-muted-foreground"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></div>
          ) : counts ? (
            <div className="space-y-2">
              <StatLine icon={ShoppingBag} label="Ventes supprimées" value={counts.vente} />
              <StatLine icon={Calendar} label="RDV supprimés" value={counts.rdv} />
              <StatLine icon={Award} label="Badges obtenus supprimés" value={counts.badge_obtenu} />
              <StatLine icon={MessageSquare} label="Commentaires supprimés" value={counts.commentaire} />
              <StatLine icon={Store} label="Offres magasin supprimées" value={counts.offre_magasin} />
              <div className="pt-2">
                <StatLine icon={Users} label="Clients remis à « À contacter »" value={counts.clients_a_reinitialiser} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aperçu indisponible.</p>
          )}
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
            ✓ Conservés : clients (identité + coordonnées), parc matériel, scores d'appétence, affectations commerciales, structure, bases, utilisateurs et paramètres.
          </div>
        </div>

        {/* Zone dangereuse */}
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-700">Action irréversible</h2>
          </div>
          <p className="text-sm text-red-800/90 mb-4">
            Cette remise à zéro supprime définitivement les données transactionnelles ci-dessus. À utiliser une seule fois, juste avant le lancement.
          </p>

          <label className="flex items-center gap-2 text-sm text-foreground mb-4">
            <input type="checkbox" checked={calerDates} onChange={(e) => setCalerDates(e.target.checked)} className="h-4 w-4" />
            Caler la période de prise de RDV sur le 13–14 octobre 2026
          </label>

          <label className="block text-sm font-medium text-foreground mb-1">Pour confirmer, tapez <span className="font-mono font-bold">{MOT_CLE}</span></label>
          <div className="flex gap-3">
            <Input value={mot} onChange={(e) => setMot(e.target.value)} placeholder={MOT_CLE} className="max-w-[200px]" />
            <Button onClick={lancer} disabled={!pret}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40">
              {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Remise à zéro…</> : <><Rocket className="h-4 w-4 mr-1.5" /> Tout remettre à zéro</>}
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-lg bg-red-100 p-3 text-xs text-red-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {result?.ok && (
            <div className="mt-3 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-800 flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Opération réinitialisée. Supprimés — ventes : {result.supprime?.vente ?? 0}, RDV : {result.supprime?.rdv ?? 0}, badges : {result.supprime?.badge_obtenu ?? 0}, commentaires : {result.supprime?.commentaire ?? 0}, offres : {result.supprime?.offre_magasin ?? 0}. Clients réinitialisés : {result.clients_reinitialises ?? 0}.
                {result.dates_prise_rdv_reglees ? ' Dates de prise de RDV calées sur le 13–14 octobre.' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
