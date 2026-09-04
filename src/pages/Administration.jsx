import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
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
import { Settings, Upload, CheckCircle2, MapPin, X, Plus, Zap } from 'lucide-react';

export default function Administration() {
  const { user } = useAuth();
  const [params, setParams] = useState(null);
  const [ventesAValider, setVentesAValider] = useState([]);
  const [bases, setBases] = useState([]);
  const [commerciaux, setCommerciaux] = useState([]);
  const [editCodes, setEditCodes] = useState({});
  const [newCode, setNewCode] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [applying, setApplying] = useState(null);
  const [applyMsg, setApplyMsg] = useState('');

  const load = async () => {
    try {
      const [p, v, b, users] = await Promise.all([
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.vente.filter({ statut_validation: 'À valider' }, '-date_vente', 100),
        base44.entities.base.list('-nom', 100),
        base44.entities.User.list('-created_date', 200)
      ]);
      setParams(p[0] || { nom_operation: '50 ans New Holland', date_debut_operation: '2026-10-01', date_fin_operation: '2026-10-31', date_debut_prise_rdv: '2026-10-13', date_fin_prise_rdv: '2026-10-14', objectif_rdv: 0, objectif_ventes: 0, objectif_ca_magasin: 0 });
      setVentesAValider(v);
      setBases(b);
      const comms = users.filter((u) => u.app_role === 'commercial');
      setCommerciaux(comms);
      const codesMap = {};
      comms.forEach((c) => { codesMap[c.id] = c.codes_communes || []; });
      setEditCodes(codesMap);
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

  // Affectation par codes communes
  const addCode = (commercialId) => {
    const code = (newCode[commercialId] || '').trim();
    if (!code) return;
    setEditCodes((prev) => ({
      ...prev,
      [commercialId]: [...(prev[commercialId] || []), code]
    }));
    setNewCode((prev) => ({ ...prev, [commercialId]: '' }));
  };

  const removeCode = (commercialId, code) => {
    setEditCodes((prev) => ({
      ...prev,
      [commercialId]: (prev[commercialId] || []).filter((c) => c !== code)
    }));
  };

  const saveCodes = async (commercialId) => {
    setSaving(true);
    try {
      await base44.entities.User.update(commercialId, { codes_communes: editCodes[commercialId] || [] });
      setSavedMsg('Codes communes enregistrés.');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      console.error(e);
      setSavedMsg('Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const applyAffectation = async (commercialId) => {
    setApplying(commercialId);
    setApplyMsg('');
    try {
      const codes = editCodes[commercialId] || [];
      if (codes.length === 0) {
        setApplyMsg('Aucun code commune à appliquer.');
        setTimeout(() => setApplyMsg(''), 3000);
        return;
      }
      let totalAssigned = 0;
      for (const code of codes) {
        await base44.entities.client.updateMany(
          { code_commune: code },
          { $addToSet: { commerciaux_assignes: commercialId } }
        );
        totalAssigned += 1;
      }
      const comm = commerciaux.find((c) => c.id === commercialId);
      setApplyMsg(`${totalAssigned} client(s) mis à jour pour ${comm?.full_name || comm?.email || 'ce commercial'}.`);
      setTimeout(() => setApplyMsg(''), 5000);
    } catch (e) {
      console.error(e);
      setApplyMsg('Erreur lors de l\'affectation. Vérifiez les permissions.');
      setTimeout(() => setApplyMsg(''), 5000);
    } finally {
      setApplying(null);
    }
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
          <TabsTrigger value="affectation">Affectation</TabsTrigger>
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

        {/* Affectation par codes communes */}
        <TabsContent value="affectation">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><MapPin className="h-4 w-4 text-gd-orange" /> Affectation par codes communes</h2>
            <p className="text-sm text-muted-foreground mb-4">Assignez des codes communes à chaque commercial. Au clic sur « Appliquer », tous les clients dont le code commune correspond seront automatiquement affectés à ce commercial.</p>
            {applyMsg && <p className="mb-3 text-sm text-emerald-600">{applyMsg}</p>}
            {commerciaux.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun commercial créé. Les comptes commerciaux seront créés à la réception de la liste.</p>
            ) : (
              <div className="space-y-4">
                {commerciaux.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{c.full_name || c.email}</p>
                        <p className="text-xs text-muted-foreground">{c.base_id ? `Base : ${c.base_id}` : 'Sans base'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveCodes(c.id)}
                          disabled={saving}
                          className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white"
                        >
                          Enregistrer
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => applyAffectation(c.id)}
                          disabled={applying === c.id}
                          className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark"
                        >
                          <Zap className="h-3.5 w-3.5 mr-1.5" />
                          {applying === c.id ? 'Affectation…' : 'Appliquer'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(editCodes[c.id] || []).map((code) => (
                        <span key={code} className="inline-flex items-center gap-1 rounded-full bg-gd-navy/10 px-2.5 py-1 text-xs font-medium text-gd-navy">
                          <MapPin className="h-3 w-3" />
                          {code}
                          <button onClick={() => removeCode(c.id, code)} className="ml-0.5 text-gd-navy/50 hover:text-gd-red">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {(editCodes[c.id] || []).length === 0 && (
                        <span className="text-xs text-muted-foreground">Aucun code commune assigné.</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ajouter un code commune (ex. 87000)…"
                        value={newCode[c.id] || ''}
                        onChange={(e) => setNewCode((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCode(c.id); } }}
                        className="text-sm"
                      />
                      <Button size="sm" variant="outline" onClick={() => addCode(c.id)} className="shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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