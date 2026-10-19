import React, { useState, useEffect } from 'react';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { listerPartage, invalider } from '@/lib/donneesPartagees';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import { isDirection } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, Tag, Plus, Link2, Check } from 'lucide-react';
import TeleventeOuest from '@/components/TeleventeOuest';

export default function Magasin() {
  const { user } = useAuth();
  const [offres, setOffres] = useState([]);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [copie, setCopie] = useState(false);
  const [form, setForm] = useState({ titre: '', date_debut: '', date_fin: '', ca_realise: 0 });
  const direction = isDirection(user);

  const load = async () => {
    try {
      const [o, p] = await Promise.all([
        listerPartage('offre_magasin', '-date_debut', 200),
        listerPartage('parametres_operation', '-created_date', 1)
      ]);
      setOffres(o);
      setParams(p[0] || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copierLienTelevente = async () => {
    const lien = `${window.location.origin}/televente`;
    try {
      await navigator.clipboard.writeText(lien);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : on laisse
      // l'adresse sélectionnable plutôt que d'échouer en silence.
      window.prompt('Lien à copier :', lien);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const caCumul = offres.reduce((s, o) => s + (o.ca_realise || 0), 0);
  const objCa = params?.objectif_ca_magasin || 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const offresActives = offres.filter((o) => o.date_debut <= todayStr && o.date_fin >= todayStr).length;

  const handleCreate = async () => {
    if (!form.titre || !form.date_debut || !form.date_fin) return;
    await base44.entities.offre_magasin.create({
      titre: form.titre,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      ca_realise: Number(form.ca_realise) || 0
    });
    setForm({ titre: '', date_debut: '', date_fin: '', ca_realise: 0 });
    setShowForm(false);
    load();
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gd-navy-dark">Magasin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suivi du CA et des offres</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Le lien public de la télévente se copie ici : c'est depuis cette
              page qu'on le partage, pas depuis une adresse à retenir. */}
          <button
            type="button"
            onClick={copierLienTelevente}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gd-navy/30 px-3 py-2 text-xs font-semibold text-gd-navy transition-colors hover:bg-gd-navy/5"
          >
            {copie ? <><Check className="h-4 w-4 text-emerald-600" /> Lien copié</> : <><Link2 className="h-4 w-4" /> Lien public télévente</>}
          </button>
          {direction && (
            <Button onClick={() => setShowForm(!showForm)} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Nouvelle offre
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-muted-foreground">CA cumulé</p>
            <Store className="h-4 w-4 text-gd-orange" />
          </div>
          <p className="text-3xl font-extrabold text-gd-navy-dark">{caCumul.toLocaleString('fr-FR')} €<span className="text-base font-medium text-muted-foreground"> / {objCa.toLocaleString('fr-FR')} €</span></p>
          <ProgressBar value={caCumul} max={objCa} className="mt-3" />
        </div>
        <StatCard label="Offres actives" value={offresActives} icon={Tag} accent />
      </div>

      {showForm && direction && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Nouvelle offre magasin</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5 lg:col-span-2"><Label>Titre</Label><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Début</Label><Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Fin</Label><Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} /></div>
            <div className="space-y-1.5 lg:col-span-3"><Label>CA réalisé (€)</Label><Input type="number" value={form.ca_realise} onChange={(e) => setForm({ ...form, ca_realise: e.target.value })} /></div>
            <div className="flex items-end"><Button onClick={handleCreate} className="w-full bg-gd-navy hover:bg-gd-navy-dark text-white">Enregistrer</Button></div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <TeleventeOuest />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <h2 className="px-5 py-4 border-b border-border text-sm font-bold uppercase tracking-wider text-muted-foreground">Historique des offres</h2>
        {loading ? (
          <Loader compact />
        ) : offres.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucune offre.</p>
        ) : (
          <div className="divide-y divide-border">
            {offres.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{o.titre}</p>
                  <p className="text-xs text-muted-foreground">{o.date_debut} → {o.date_fin}</p>
                </div>
                <p className="text-sm font-bold text-gd-navy">{(o.ca_realise || 0).toLocaleString('fr-FR')} €</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}