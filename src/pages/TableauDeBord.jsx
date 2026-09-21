import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import ProspectsMap from '@/components/ProspectsMap';
import { isDirection, getAppRole } from '@/lib/permissions';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  CalendarClock, Timer, CheckCircle2, Target, Store, TrendingUp, Trophy, AlertCircle
} from 'lucide-react';
import { useDemoPersona } from '@/lib/useDemoPersona';

const CHART_COLORS = ['hsl(212 100% 21%)', 'hsl(45 100% 51%)', 'hsl(213 25% 66%)', 'hsl(0 64% 51%)', 'hsl(215 100% 28%)', 'hsl(45 100% 40%)', 'hsl(210 20% 50%)'];
const TYPES_MACHINE = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger'];
const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

export default function TableauDeBord() {
  const { user, viewAsRole } = useAuth();
  const persona = useDemoPersona();
  const [params, setParams] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [offres, setOffres] = useState([]);
  const [users, setUsers] = useState([]);
  const [structure, setStructure] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const direction = isDirection(user, viewAsRole);
  const role = getAppRole(user, viewAsRole);
  const canFilterMap = role === 'direction' || role === 'responsable';
  // Un commercial ne voit que SES propres RDV sur la carte ; un responsable ceux de son équipe ; la direction tout.
  const mapRdvs = direction
    ? rdvs
    : role === 'responsable'
      ? rdvs.filter((r) => r.base_responsable_id === user?.id)
      : rdvs.filter((r) => r.commercial_id === user?.id);

  const load = useCallback(async () => {
    try {
      const [p, r, v, o, u, s] = await Promise.all([
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.rdv.list('-date_heure', 1000),
        base44.entities.vente.list('-date_vente', 1000),
        base44.entities.offre_magasin.list('-created_date', 200),
        base44.entities.User.list('-created_date', 100).catch(() => []),
        base44.entities.structure_commerciale.list('-nom_commercial', 200)
      ]);
      // Filter by demo persona
      const personaRdvs = persona.mode ? r.filter((rd) => persona.matchCommercialId(rd.commercial_id)) : r;
      const personaVentes = persona.mode ? v.filter((vd) => persona.matchCommercialId(vd.commercial_id)) : v;
      setParams(p[0] || null);
      setRdvs(personaRdvs);
      setVentes(personaVentes);
      setOffres(o);
      setUsers(u);
      setStructure(s);
      // Load clients for map (those with RDV) — batch via filter
      const clientIds = [...new Set(personaRdvs.map((rd) => rd.client_id))].slice(0, 200);
      const cmap = {};
      // Batch: filter by client_id in chunks of 50
      for (let i = 0; i < clientIds.length; i += 50) {
        const chunk = clientIds.slice(i, i + 50);
        const results = await base44.entities.client.filter({ id: { $in: chunk } }, '-created_date', 50);
        results.forEach((c) => { cmap[c.id] = c; });
      }
      setClients(cmap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [persona.mode, persona.ids.join(',')]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Build name map: User IDs + structure_commerciale IDs → display name
  const nameMap = useMemo(() => {
    const m = {};
    users.forEach((u) => { m[u.id] = u.full_name || u.email; });
    structure.forEach((s) => { m[s.id] = s.nom_commercial; });
    return m;
  }, [users, structure]);

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div></Layout>;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const countdownOp = params ? daysBetween(params.date_fin_operation) : null;
  const countdownRdv = params ? daysBetween(params.date_fin_prise_rdv) : null;
  const showCountdownRdv = countdownRdv !== null && countdownRdv > -3 && countdownRdv < 15;

  const rdvMoisReal = rdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure >= monthStart);
  const rdvMaterielMonth = rdvMoisReal.filter((r) => r.type !== 'RDV atelier hivernage').length;
  const rdvAtelierMonth = rdvMoisReal.filter((r) => r.type === 'RDV atelier hivernage').length;
  const rdvTotalMonth = rdvMoisReal.length;

  const ventesValidees = ventes.filter((v) => v.statut_validation === 'Validé');
  const ventesParMachine = TYPES_MACHINE.map((t) => ({ name: t, value: ventesValidees.filter((v) => v.type_machine === t).length })).filter((d) => d.value > 0);
  const ventesParType = TYPES_VENTE.map((t) => ({ name: t, value: ventesValidees.filter((v) => v.type_vente === t).length }));
  const reprisesData = [
    { name: 'Sans reprise', value: ventesValidees.filter((v) => v.reprise === 'Sans reprise').length },
    { name: 'Reprise NH', value: ventesValidees.filter((v) => v.reprise === 'Reprise NH').length },
    { name: 'Reprise autre marque', value: ventesValidees.filter((v) => v.reprise === 'Reprise autre marque').length }
  ];
  const marquesReprise = {};
  ventesValidees.filter((v) => v.reprise === 'Reprise autre marque' && v.marque_reprise).forEach((v) => {
    marquesReprise[v.marque_reprise] = (marquesReprise[v.marque_reprise] || 0) + 1;
  });

  const caMagasin = offres.reduce((sum, o) => sum + (o.ca_realise || 0), 0);
  const objRdv = params?.objectif_rdv || 0;
  const objVentes = params?.objectif_ventes || 0;
  const objCa = params?.objectif_ca_magasin || 0;

  const ventesWhatsapp = ventes.filter((v) => v.source_declaration === 'Import WhatsApp');
  const lastWhatsapp = ventesWhatsapp.length > 0
    ? ventesWhatsapp.reduce((max, v) => v.created_date > max ? v.created_date : max, ventesWhatsapp[0].created_date)
    : null;

  const isReadOnly = countdownOp !== null && countdownOp < 0 && !direction;

  return (
    <Layout>
      {isReadOnly && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertCircle className="h-4 w-4" />
          L'opération est terminée — l'application est en lecture seule.
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">{params?.nom_operation || '50 ans Gonnin Duris × New Holland'} · mise à jour auto toutes les 30 s</p>
      </div>

      {/* Countdowns */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Fin de l'opération" value={countdownOp !== null ? `${countdownOp} j` : '—'} sublabel={params?.date_fin_operation} icon={CalendarClock} accent />
        {showCountdownRdv && (
          <StatCard label="Fin prise de RDV" value={`${countdownRdv} j`} sublabel={params?.date_fin_prise_rdv} icon={Timer} accent />
        )}
        <StatCard label="RDV Matériel (mois)" value={rdvMaterielMonth} icon={CheckCircle2} />
        <StatCard label="RDV Atelier (mois)" value={rdvAtelierMonth} icon={Timer} />
      </div>

      {/* Objectives */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-muted-foreground">RDV réalisés (mois)</p>
            <Target className="h-4 w-4 text-gd-orange" />
          </div>
          <p className="text-3xl font-extrabold text-gd-navy-dark">{rdvTotalMonth}<span className="text-base font-medium text-muted-foreground"> / {objRdv}</span></p>
          <ProgressBar value={rdvTotalMonth} max={objRdv} className="mt-3" />
          <div className="mt-3 flex gap-4 text-xs">
            <span className="text-muted-foreground">🚜 Matériel : <span className="font-bold text-gd-navy-dark">{rdvMaterielMonth}</span></span>
            <span className="text-muted-foreground">🔧 Atelier : <span className="font-bold text-gd-navy-dark">{rdvAtelierMonth}</span></span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-muted-foreground">Ventes validées</p>
            <TrendingUp className="h-4 w-4 text-gd-orange" />
          </div>
          <p className="text-3xl font-extrabold text-gd-navy-dark">{ventesValidees.length}<span className="text-base font-medium text-muted-foreground"> / {objVentes}</span></p>
          <ProgressBar value={ventesValidees.length} max={objVentes} className="mt-3" barClassName="bg-gd-orange" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-muted-foreground">CA magasin</p>
            <Store className="h-4 w-4 text-gd-orange" />
          </div>
          <p className="text-3xl font-extrabold text-gd-navy-dark">{caMagasin.toLocaleString('fr-FR')} €<span className="text-base font-medium text-muted-foreground"> / {objCa.toLocaleString('fr-FR')} €</span></p>
          <ProgressBar value={caMagasin} max={objCa} className="mt-3" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">Ventes par type de machine</h2>
          {ventesParMachine.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Aucune vente validée.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ventesParMachine} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(45 100% 51% / 0.1)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {ventesParMachine.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">Répartition des ventes</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={ventesParType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {ventesParType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">Répartition des reprises</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reprisesData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'hsl(45 100% 51% / 0.1)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="hsl(212 100% 21%)" />
            </BarChart>
          </ResponsiveContainer>
          {Object.keys(marquesReprise).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(marquesReprise).map(([m, c]) => (
                <span key={m} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{m} : {c}</span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4 text-gd-orange" /> Podium (RDV réalisés)
          </h2>
          <Podium rdvs={rdvs} nameMap={nameMap} />
        </div>
      </div>

      {/* Carte des prospects avec RDV — masquée en consultation publique (collaborateur) : localisations clients privées */}
      {role !== 'collaborateur' && (
        <div className="mt-6">
          <ProspectsMap rdvs={mapRdvs} clients={clients} users={users} canFilter={canFilterMap} />
        </div>
      )}

      {lastWhatsapp && (
        <p className="mt-4 text-xs text-muted-foreground">
          Dernière mise à jour des ventes WhatsApp : {new Date(lastWhatsapp).toLocaleString('fr-FR')}
        </p>
      )}
    </Layout>
  );
}

function Podium({ rdvs, nameMap = {} }) {
  const counts = {};
  rdvs.filter((r) => r.statut === 'Réalisé').forEach((r) => {
    counts[r.commercial_id] = (counts[r.commercial_id] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Aucun RDV réalisé.</p>;
  return (
    <div className="space-y-2">
      {sorted.map(([cid, count], i) => (
        <div key={cid} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-gd-orange text-gd-navy-dark' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
          <span className="flex-1 text-sm font-semibold text-foreground truncate">{nameMap[cid] || 'Commercial'}</span>
          <span className="text-sm font-bold text-gd-navy">{count} RDV</span>
        </div>
      ))}
    </div>
  );
}