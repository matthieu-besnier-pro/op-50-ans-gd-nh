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
import { Settings, Upload, CheckCircle2, MapPin, X, Plus, Zap, Users, Award, Tractor, Briefcase, Calendar, ShoppingBag } from 'lucide-react';
import AdminUsers from '@/components/AdminUsers';
import AdminBadges from '@/components/AdminBadges';
import AdminBases from '@/components/AdminBases';
import AdminAffectationManuelle from '@/components/AdminAffectationManuelle';
import AdminAffectationImport from '@/components/AdminAffectationImport';
import AdminAffectationCommunesImport from '@/components/AdminAffectationCommunesImport';
import AdminOffres from '@/components/AdminOffres';
import AdminClientsListing from '@/components/AdminClientsListing';
import AdminImportDonnees from '@/components/AdminImportDonnees';
import AdminComptesDemo from '@/components/AdminComptesDemo';
import AdminStructureCommerciale from '@/components/AdminStructureCommerciale';

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
  const [activeTab, setActiveTab] = useState('overview');
  const [clientsList, setClientsList] = useState([]);
  const [globalStats, setGlobalStats] = useState({ clients: 0, materiels: 0, rdvs: 0, ventes: 0, users: 0, badges: 0 });

  const load = async () => {
    try {
      const [p, v, b, users, allClients, allMateriels, allRdvs, allVentes, allBadges] = await Promise.all([
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.vente.filter({ statut_validation: 'À valider' }, '-date_vente', 100),
        base44.entities.base.list('-nom', 100),
        base44.entities.User.list('-created_date', 200),
        base44.entities.client.list('-created_date', 500),
        base44.entities.materiel.list('-created_date', 500),
        base44.entities.rdv.list('-date_heure', 500),
        base44.entities.vente.list('-date_vente', 500),
        base44.entities.badge.list('-created_date', 50)
      ]);
      setParams(p[0] || { nom_operation: '50 ans New Holland', date_debut_operation: '2026-10-01', date_fin_operation: '2026-10-31', date_debut_prise_rdv: '2026-10-13', date_fin_prise_rdv: '2026-10-14', objectif_rdv: 0, objectif_ventes: 0, objectif_ca_magasin: 0 });
      setVentesAValider(v);
      setBases(b);
      const comms = users.filter((u) => u.app_role === 'commercial');
      setCommerciaux(comms);
      const codesMap = {};
      comms.forEach((c) => { codesMap[c.id] = c.codes_communes || []; });
      setEditCodes(codesMap);
      setClientsList(allClients);
      setGlobalStats({
        clients: allClients.length, materiels: allMateriels.length,
        rdvs: allRdvs.length, ventes: allVentes.length,
        users: users.length, badges: allBadges.length
      });
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="params">Paramètres</TabsTrigger>
          <TabsTrigger value="ventes">Ventes à valider ({ventesAValider.length})</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="affectation">Affectation (communes)</TabsTrigger>
          <TabsTrigger value="clients-listing">Listing clients</TabsTrigger>
          <TabsTrigger value="structure">Structure commerciale</TabsTrigger>
          <TabsTrigger value="affectation-manuelle">Affectation manuelle</TabsTrigger>
          <TabsTrigger value="import-affectation">Import affectation</TabsTrigger>
          <TabsTrigger value="offres">Offres magasin</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="bases">Bases</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Clients" value={globalStats.clients} icon={Briefcase} />
            <StatCard label="Matériels" value={globalStats.materiels} icon={Tractor} />
            <StatCard label="RDV" value={globalStats.rdvs} icon={Calendar} />
            <StatCard label="Ventes" value={globalStats.ventes} icon={ShoppingBag} />
            <StatCard label="Utilisateurs" value={globalStats.users} icon={Users} />
            <StatCard label="Badges" value={globalStats.badges} icon={Award} accent />
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Actions rapides</h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setActiveTab('ventes')} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> {ventesAValider.length} vente(s) à valider
              </Button>
              <Button onClick={() => setActiveTab('users')} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                <Users className="h-4 w-4 mr-1.5" /> Gérer les utilisateurs
              </Button>
              <Button onClick={() => setActiveTab('badges')} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                <Award className="h-4 w-4 mr-1.5" /> Gérer les badges
              </Button>
              <Button onClick={() => setActiveTab('bases')} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                <MapPin className="h-4 w-4 mr-1.5" /> Gérer les bases
              </Button>
              <Button onClick={() => setActiveTab('params')} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                <Settings className="h-4 w-4 mr-1.5" /> Paramètres opération
              </Button>
            </div>
          </div>
        </TabsContent>

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

        {/* Utilisateurs */}
        <TabsContent value="users">
          <AdminUsers bases={bases} onReload={load} />
        </TabsContent>

        {/* Affectation par codes communes */}
        <TabsContent value="affectation">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><MapPin className="h-4 w-4 text-gd-orange" /> Affectation par codes communes</h2>
            <p className="text-sm text-muted-foreground mb-4">Assignez des codes communes à chaque commercial. Au clic sur « Appliquer », tous les clients dont le code commune correspond seront automatiquement affectés à ce commercial.</p>

            <div className="mb-4 rounded-lg border border-gd-orange/30 bg-gd-orange/5 p-4">
              <p className="mb-3 text-sm font-semibold text-gd-navy">📥 Import en masse de la structure</p>
              <AdminAffectationCommunesImport commerciaux={commerciaux} onReload={load} />
            </div>

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

        {/* Listing des clients avec attribution */}
        <TabsContent value="clients-listing">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Briefcase className="h-4 w-4 text-gd-orange" /> Listing des clients & attribution commerciale</h2>
            <p className="text-sm text-muted-foreground mb-4">Vue complète de tous les clients avec leur(s) commercial(aux) assigné(s). Filtrez par commercial, base ou statut d'affectation.</p>
            <AdminClientsListing commerciaux={commerciaux} bases={bases} />
          </div>
        </TabsContent>

        {/* Structure commerciale */}
        <TabsContent value="structure">
          <AdminComptesDemo onReload={load} />
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Users className="h-4 w-4 text-gd-orange" /> Structure commerciale</h2>
            <p className="text-sm text-muted-foreground mb-4">Liste des 23 commerciaux et 4 managers avec leurs codes communes.</p>
            <AdminStructureCommerciale />
          </div>
        </TabsContent>

        {/* Affectation manuelle client par client */}
        <TabsContent value="affectation-manuelle">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Users className="h-4 w-4 text-gd-orange" /> Affectation manuelle des clients</h2>
            <p className="text-sm text-muted-foreground mb-4">Assignez ou retirez des commerciaux client par client. Utilisez la recherche et les filtres pour cibler les clients non assignés.</p>
            <AdminAffectationManuelle commerciaux={commerciaux} />
          </div>
        </TabsContent>

        {/* Import d'affectation en masse */}
        <TabsContent value="import-affectation">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Upload className="h-4 w-4 text-gd-orange" /> Import d'affectation en masse</h2>
            <p className="text-sm text-muted-foreground mb-4">Importez un fichier Excel ou CSV pour affecter en masse les clients aux commerciaux. Le fichier doit contenir le SIREN (ou code commune) du client et l'email du commercial.</p>
            <AdminAffectationImport commerciaux={commerciaux} clients={clientsList} onReload={load} />
          </div>
        </TabsContent>

        {/* Offres magasin */}
        <TabsContent value="offres">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><ShoppingBag className="h-4 w-4 text-gd-orange" /> Offres magasin</h2>
            <AdminOffres />
          </div>
        </TabsContent>

        {/* Badges */}
        <TabsContent value="badges">
          <AdminBadges />
        </TabsContent>

        {/* Bases */}
        <TabsContent value="bases">
          <AdminBases />
        </TabsContent>

        {/* Import */}
        <TabsContent value="import">
          <div className="mb-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Upload className="h-4 w-4 text-gd-orange" /> Import de données</h2>
            <p className="text-sm text-muted-foreground">Importez les exports MISTRA / SIV puis PAC pour créer les clients, leur matériel et calculer les scores d'appétence.</p>
          </div>
          <AdminImportDonnees onReload={load} />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}