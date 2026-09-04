import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Upload, CheckCircle2, Users, Target } from 'lucide-react';

export default function Administration() {
  const [params, setParams] = useState(null);
  const [ventesAValider, setVentesAValider] = useState([]);
  const [bases, setBases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const load = async () => {
    try {
      const [p, v, b] = await Promise.all([
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.vente.filter({ statut_validation: 'À valider' }, '-date_vente', 100),
        base44.entities.base.list('-nom', 100)
      ]);
      setParams(p[0] || { nom_operation: '50 ans New Holland', date_debut_operation: '2026-10-01', date_fin_operation: '2026-10-31', date_debut_prise_rdv: '2026-10-13', date_fin_prise_rdv: '2026-10-14', objectif_rdv: 0, objectif_ventes: 0, objectif_ca_magasin: 0 });
      setVentesAValider(v);
      setBases(b);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaveParams = async () => {
    setSaving(true);
    try {
      if (params.id) {
        await base44.entities.parametres_operation.update(params.id, params);
      } else {
        const created = await base44.entities.parametres_operation.create(params);
        setParams(created);
      }
      setSavedMsg('Paramètres enregistrés.');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const validerVente = async (id) => {
    await base44.entities.vente.update(id, { statut_validation: 'Validé' });
    try { await base44.functions.invoke('verifier_badges', {}); } catch (e) { /* ignore */ }
    load();
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">Direction / Marketing</p>
      </div>

      <Tabs defaultValue="params">
        <TabsList className="mb-4">
          <TabsTrigger value="params">Paramètres</TabsTrigger>
          <TabsTrigger value="ventes">Ventes à valider ({ventesAValider.length})</TabsTrigger>
          <TabsTrigger value="bases">Bases</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        {/* Paramètres */}
        <TabsContent value="params">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm max-w-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Settings className="h-4 w-4 text-gd-orange" /> Paramètres de l'opération</h2>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Nom de l'opération</Label><Input value={params?.nom_operation || ''} onChange={(e) => setParams({ ...params, nom_operation: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Début opération</Label><Input type="date" value={params?.date_debut_operation || ''} onChange={(e) => setParams({ ...params, date_debut_operation: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Fin opération</Label><Input type="date" value={params?.date_fin_operation || ''} onChange={(e) => setParams({ ...params, date_fin_operation: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Début prise de RDV</Label><Input type="date" value={params?.date_debut_prise_rdv || ''} onChange={(e) => setParams({ ...params, date_debut_prise_rdv: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Fin prise de RDV</Label><Input type="date" value={params?.date_fin_prise_rdv || ''} onChange={(e) => setParams({ ...params, date_fin_prise_rdv: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Objectif RDV</Label><Input type="number" value={params?.objectif_rdv || 0} onChange={(e) => setParams({ ...params, objectif_rdv: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Objectif ventes</Label><Input type="number" value={params?.objectif_ventes || 0} onChange={(e) => setParams({ ...params, objectif_ventes: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Objectif CA magasin (€)</Label><Input type="number" value={params?.objectif_ca_magasin || 0} onChange={(e) => setParams({ ...params, objectif_ca_magasin: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveParams} disabled={saving} className="bg-gd-navy hover:bg-gd-navy-dark text-white">{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
                {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Ventes à valider */}
        <TabsContent value="ventes">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <h2 className="px-5 py-4 border-b border-border text-sm font-bold uppercase tracking-wider text-muted-foreground">Ventes en attente de validation</h2>
            {ventesAValider.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucune vente à valider.</p>
            ) : (
              <div className="divide-y divide-border">
                {ventesAValider.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{v.type_machine} · {v.type_vente}</p>
                      <p className="text-xs text-muted-foreground">{v.date_vente} · {v.source_declaration}{v.reprise !== 'Sans reprise' ? ` · ${v.reprise}${v.marque_reprise ? ' ' + v.marque_reprise : ''}` : ''}</p>
                    </div>
                    <Button onClick={() => validerVente(v.id)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Valider
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Bases */}
        <TabsContent value="bases">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <h2 className="px-5 py-4 border-b border-border text-sm font-bold uppercase tracking-wider text-muted-foreground">Bases de rattachement</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entité</th>
                </tr>
              </thead>
              <tbody>
                {bases.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{b.nom}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{b.zone}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{b.entite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Import */}
        <TabsContent value="import">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm max-w-2xl">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Upload className="h-4 w-4 text-gd-orange" /> Import de données</h2>
            <p className="text-sm text-muted-foreground mb-4">Importez les exports MISTRA, SIV et PAC pour créer ou mettre à jour les clients et le matériel. L'import exclut automatiquement les points de vente hors périmètre et les SIREN internes au groupe.</p>
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Import CSV MISTRA / SIV / PAC</p>
                <p className="text-xs text-muted-foreground mt-1">Fonctionnalité d'import à configurer avec les fichiers reçus.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}