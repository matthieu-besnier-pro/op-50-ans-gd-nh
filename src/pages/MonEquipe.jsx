import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ArrowUp, ArrowDown, AlertTriangle, Calendar, TrendingUp, Percent, Wallet } from 'lucide-react';

const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite', 'RDV obtenu', 'Prise de RDV atelier', 'Devis en cours', 'Offre magasin à proposer', 'Vente conclue', 'Refus'];
const STATUT_COLORS = ['bg-slate-300', 'bg-orange-400', 'bg-amber-400', 'bg-slate-400', 'bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-cyan-400', 'bg-emerald-400', 'bg-red-400'];

export default function MonEquipe() {
  const { user } = useAuth();
  const [commerciaux, setCommerciaux] = useState([]);
  const [clients, setClients] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rdv');
  const [prevRanks, setPrevRanks] = useState({});

  const load = async () => {
    try {
      const res = await base44.functions.invoke('lister_equipe', {});
      const members = res.data?.members || [];
      setCommerciaux(members);
      const memberIds = members.map((m) => m.id);

      const [allClients, allRdvs, allVentes] = await Promise.all([
        base44.entities.client.list('-created_date', 500),
        base44.entities.rdv.list('-date_heure', 500),
        base44.entities.vente.list('-date_vente', 500)
      ]);
      setClients(allClients);
      setRdvs(allRdvs.filter((r) => memberIds.includes(r.commercial_id)));
      setVentes(allVentes.filter((v) => memberIds.includes(v.commercial_id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const rows = useMemo(() => {
    return commerciaux.map((c) => {
      const myClients = clients.filter((cl) => (cl.commerciaux_assignes || []).includes(c.id));
      const myRdvs = rdvs.filter((r) => r.commercial_id === c.id);
      const myVentes = ventes.filter((v) => v.commercial_id === c.id);
      const ventesValidees = myVentes.filter((v) => v.statut_validation === 'Validé');
      const rdvRealisesToday = myRdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure?.slice(0, 10) === todayStr).length;
      const rdvRealisesMonth = myRdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure >= monthStart).length;
      const tauxTransfo = rdvRealisesMonth > 0 ? Math.round((ventesValidees.length / rdvRealisesMonth) * 100) : 0;
      const pipeDevis = myClients.filter((cl) => cl.statut === 'Devis en cours').reduce((s, cl) => s + (cl.montant_devis || 0), 0);
      const repartition = STATUTS.map((s) => myClients.filter((cl) => cl.statut === s).length);
      return {
        id: c.id, nom: c.full_name || c.email,
        repartition, totalClients: myClients.length,
        rdvToday: rdvRealisesToday, rdvMonth: rdvRealisesMonth,
        ventes: ventesValidees.length, tauxTransfo, pipeDevis
      };
    });
  }, [commerciaux, clients, rdvs, ventes]);

  const sorted = useMemo(() => {
    const arr = [...rows].sort((a, b) => sortBy === 'rdv' ? b.rdvMonth - a.rdvMonth : b.ventes - a.ventes);
    return arr.map((r, i) => ({ ...r, rank: i, prevRank: prevRanks[r.id] }));
  }, [rows, sortBy, prevRanks]);

  useEffect(() => {
    const newRanks = {};
    sorted.forEach((r, i) => { newRanks[r.id] = i; });
    setPrevRanks(newRanks);
  }, [sorted.map((r) => r.id).join(','), sortBy]);

  // KPIs agrégés de l'équipe
  const teamKpis = useMemo(() => {
    const totalRdv = rows.reduce((s, r) => s + r.rdvMonth, 0);
    const totalVentes = rows.reduce((s, r) => s + r.ventes, 0);
    const avgTransfo = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.tauxTransfo, 0) / rows.length) : 0;
    const totalPipe = rows.reduce((s, r) => s + r.pipeDevis, 0);
    return { totalRdv, totalVentes, avgTransfo, totalPipe };
  }, [rows]);

  // Alertes
  const alertes = useMemo(() => {
    const sansRdv = rows.filter((r) => r.rdvMonth === 0).map((r) => r.nom);
    const injoignables = clients.filter((c) => (c.nb_tentatives_contact || 0) >= 3);
    return { sansRdv, injoignablesCount: injoignables.length };
  }, [rows, clients]);

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gd-navy-dark">Mon équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">{commerciaux.length} commercial{commerciaux.length > 1 ? 'aux' : ''} · {clients.length} clients suivis</p>
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rdv">Trier par RDV réalisés</SelectItem>
            <SelectItem value="ventes">Trier par ventes validées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs agrégés */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="RDV équipe (mois)" value={teamKpis.totalRdv} icon={Calendar} />
        <StatCard label="Ventes validées" value={teamKpis.totalVentes} icon={TrendingUp} />
        <StatCard label="Tx transfo moyen" value={`${teamKpis.avgTransfo}%`} icon={Percent} />
        <StatCard label="Pipe devis" value={`${teamKpis.totalPipe.toLocaleString('fr-FR')} €`} icon={Wallet} />
      </div>

      {/* Alertes */}
      {(alertes.sansRdv.length > 0 || alertes.injoignablesCount > 0) && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-orange-800">
            <AlertTriangle className="h-4 w-4" /> Alertes
          </h2>
          <div className="space-y-2">
            {alertes.sansRdv.length > 0 && (
              <p className="text-sm text-orange-800">
                <span className="font-semibold">{alertes.sansRdv.length}</span> commercial{alertes.sansRdv.length > 1 ? 'aux' : ''} sans RDV ce mois : {alertes.sansRdv.join(', ')}
              </p>
            )}
            {alertes.injoignablesCount > 0 && (
              <p className="text-sm text-orange-800">
                <span className="font-semibold">{alertes.injoignablesCount}</span> client{alertes.injoignablesCount > 1 ? 's' : ''} injoignable{alertes.injoignablesCount > 1 ? 's' : ''} (3 tentatives +)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tableau classement */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commercial</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Répartition clients</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">RDV (auj / mois)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tx transfo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ventes validées</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipe devis</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Chargement…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun commercial dans l'équipe. Les comptes commerciaux seront créés à la réception de la liste.</td></tr>
            ) : sorted.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 transition-all duration-500 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gd-navy">{r.rank + 1}</span>
                    {r.prevRank !== undefined && r.prevRank !== r.rank && (
                      r.prevRank > r.rank ? <ArrowUp className="h-3 w-3 text-emerald-500" /> : <ArrowDown className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-sm text-foreground">{r.nom}</td>
                <td className="px-4 py-3">
                  {r.totalClients > 0 ? (
                    <>
                      <div className="flex h-2 w-32 overflow-hidden rounded-full bg-muted">
                        {r.repartition.map((count, i) => count > 0 && (
                          <div key={i} className={STATUT_COLORS[i]} style={{ width: `${(count / r.totalClients) * 100}%` }} title={`${STATUTS[i]}: ${count}`} />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{r.totalClients} clients</p>
                    </>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm"><span className="font-semibold text-foreground">{r.rdvToday}</span> / <span className="text-muted-foreground">{r.rdvMonth}</span></td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{r.tauxTransfo}%</td>
                <td className="px-4 py-3 text-sm font-bold text-gd-navy">{r.ventes}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.pipeDevis.toLocaleString('fr-FR')} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}