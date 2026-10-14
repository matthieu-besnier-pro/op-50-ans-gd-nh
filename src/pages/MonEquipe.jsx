import React, { useState, useEffect, useMemo } from 'react';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { listerPartage, invalider, fetchClients } from '@/lib/donneesPartagees';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ArrowUp, ArrowDown, AlertTriangle, Calendar, TrendingUp, Percent } from 'lucide-react';
import { useDemoPersona } from '@/lib/useDemoPersona';
import { useOperationStats } from '@/lib/useOperationStats';
import { useStatuts, tonaliteDe } from '@/lib/statuts';

export default function MonEquipe() {
  const { user } = useAuth();
  const persona = useDemoPersona();
  // Le responsable SAV encadre des chefs d'atelier : le vocabulaire doit suivre,
  // qu'on soit connecté comme lui ou qu'on le visionne en « Voir en tant que ».
  const estSav = (user?.app_role || '') === 'responsable_sav' || persona.mode === 'atelier';
  const stats = useOperationStats();
  // Liste des statuts administrée par la Direction (Administration → Statuts).
  const statuts = useStatuts();
  const [commerciaux, setCommerciaux] = useState([]);
  const [clients, setClients] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rdv');
  const [prevRanks, setPrevRanks] = useState({});

  const load = async () => {
    try {
      // Persona « atelier » : l'équipe d'un responsable SAV, ce sont les CHEFS
      // D'ATELIER de ses sites. Ils ne figurent pas dans la structure
      // commerciale — on les demande au serveur, site par site. Sans cette
      // branche, la page retombait sur le compte réellement connecté.
      if (persona.mode === 'atelier') {
        const res = await base44.functions.invoke('lister_equipe', { sites: persona.sites || [] });
        const membres = (res.data?.members || []).map((m) => ({
          id: m.id, user_id: m.user_id || m.id, nom: null,
          full_name: m.full_name || m.email, email: m.email || '', base_id: m.base_id || '',
          sites: m.sites || null
        }));
        setCommerciaux(membres);
        const ids = membres.map((m) => m.id);
        const [allClients, allRdvs, allVentes] = await Promise.all([
          fetchClients().then((r) => r.clients),
          listerPartage('rdv', '-date_heure', 1000),
          listerPartage('vente', '-date_vente', 1000)
        ]);
        setClients(allClients.filter(persona.matchClient));
        setRdvs(allRdvs.filter((r) => ids.includes(r.commercial_id)));
        setVentes(allVentes.filter((v) => ids.includes(v.commercial_id)));
        return;
      }

      // Demo mode (manager persona): use structure_commerciale instead of real users
      if (persona.mode === 'manager') {
        const teamRows = persona.structure.filter((s) => s.manager === persona.label?.replace('Équipe de ', ''));
        const members = teamRows.map((s) => ({ id: s.user_id || s.id, user_id: s.user_id || null, nom: s.nom_commercial, full_name: s.nom_commercial, email: s.email || '', base_id: '' }));
        setCommerciaux(members);
        const memberIds = members.map((m) => m.id);
        const [allClients, allRdvs, allVentes] = await Promise.all([
          fetchClients().then((r) => r.clients),
          listerPartage('rdv', '-date_heure', 1000),
          listerPartage('vente', '-date_vente', 1000)
        ]);
        setClients(allClients.filter((c) => (c.commerciaux_assignes || []).some((id) => memberIds.includes(id))));
        setRdvs(allRdvs.filter((r) => memberIds.includes(r.commercial_id)));
        setVentes(allVentes.filter((v) => memberIds.includes(v.commercial_id)));
        return;
      }

      // Non-demo : la liste des commerciaux est celle des profils issus des fichiers
      // d'import (structure_commerciale), enrichie des comptes utilisateurs existants.
      const [res, structRows] = await Promise.all([
        base44.functions.invoke('lister_equipe', {}),
        listerPartage('structure_commerciale', '-nom_commercial', 200)
      ]);
      const equipeMembers = res.data?.members || [];
      // Un responsable ne voit que ses vendeurs : le serveur renvoie leurs noms.
      // Pour la Direction, « fiches » vaut null et toute la structure est conservée.
      const noms = res.data?.fiches;
      const mesFiches = Array.isArray(noms)
        ? structRows.filter((s) => noms.includes(s.nom_commercial))
        : structRows;
      const userById = {};
      equipeMembers.forEach((m) => { userById[m.id] = m; });
      const members = mesFiches.map((s) => ({
        id: s.user_id || s.id,
        user_id: s.user_id || null,
        nom: s.nom_commercial,
        full_name: userById[s.user_id]?.full_name || s.nom_commercial,
        email: s.email || userById[s.user_id]?.email || '',
        base_id: ''
      }));
      const rosterIds = new Set(members.map((m) => m.id));
      equipeMembers.forEach((m) => {
        if (!rosterIds.has(m.id)) members.push({ id: m.id, user_id: m.user_id || m.id, nom: null, full_name: m.full_name || m.email, email: m.email || '', base_id: m.base_id || '', sites: m.sites || null });
      });
      setCommerciaux(members);
      const memberIds = members.map((m) => m.id);

      const [allClients, allRdvs, allVentes] = await Promise.all([
        fetchClients().then((r) => r.clients),
        listerPartage('rdv', '-date_heure', 1000),
        listerPartage('vente', '-date_vente', 1000)
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

  useEffect(() => { load(); }, [persona.mode, persona.ids.join(',')]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const rows = useMemo(() => {
    const parSecteur = stats?.clients?.par_secteur || null;
    const parCommercial = stats?.clients?.par_commercial || null;
    return commerciaux.map((c) => {
      // Comptages serveur exacts quand le commercial est reconnu, sinon listes chargées
      const exact = (c.user_id && parCommercial?.[c.user_id]) || (c.nom && parSecteur?.[c.nom]) || null;
      const rdvExact = stats?.rdv?.par_commercial?.[c.id];
      const ventesExactes = stats?.ventes?.par_commercial?.[c.id];
      const myClients = clients.filter((cl) => (cl.commerciaux_assignes || []).includes(c.id));
      const myRdvs = rdvs.filter((r) => r.commercial_id === c.id);
      const myVentes = ventes.filter((v) => v.commercial_id === c.id);
      const ventesValidees = ventesExactes !== undefined ? ventesExactes : myVentes.filter((v) => v.statut_validation === 'Validé').length;
      const rdvPrisToday = rdvExact?.pris_jour ?? myRdvs.filter((r) => r.statut !== 'Annulé' && r.date_heure?.slice(0, 10) === todayStr).length;
      // Période de l'opération si elle est définie, sinon le mois — des deux côtés,
      // sinon le taux compare des ventes de toujours à des RDV du mois.
      const rdvPrisMonth = rdvExact
        ? (rdvExact.pris_operation ?? rdvExact.pris_mois ?? 0)
        : myRdvs.filter((r) => r.statut !== 'Annulé' && r.date_heure >= monthStart).length;
      const ventesPeriode = stats?.ventes?.operation_par_commercial
        ? (stats.ventes.operation_par_commercial[c.id] || 0)
        : ventesValidees;
      const tauxTransfo = rdvPrisMonth > 0 ? Math.round((ventesPeriode / rdvPrisMonth) * 100) : 0;
      const repartition = exact
        ? statuts.map((s) => exact.par_statut[s.nom] || 0)
        : statuts.map((s) => myClients.filter((cl) => cl.statut === s.nom).length);
      return {
        id: c.id, nom: c.full_name || c.email,
        // Les chefs d'atelier portent leur(s) site(s) ; les commerciaux, rien.
        site: Array.isArray(c.sites) ? c.sites.join(' · ') : '',
        sansCompte: !c.user_id || String(c.user_id).startsWith('chef:'),
        repartition, totalClients: exact ? exact.total : myClients.length,
        rdvToday: rdvPrisToday, rdvMonth: rdvPrisMonth,
        ventes: ventesValidees, tauxTransfo
      };
    });
  }, [commerciaux, clients, rdvs, ventes, stats, statuts, todayStr, monthStart]);

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
    return { totalRdv, totalVentes, avgTransfo };
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
          <p className="mt-1 text-sm text-muted-foreground">
            {/* Un responsable SAV encadre des chefs d'atelier, pas des commerciaux. */}
            {commerciaux.length} {estSav
              ? `chef${commerciaux.length > 1 ? 's' : ''} d'atelier`
              : `commercial${commerciaux.length > 1 ? 'aux' : ''}`} · {(stats?.clients?.total ?? clients.length).toLocaleString('fr-FR')} clients suivis
          </p>
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rdv">Trier par RDV pris</SelectItem>
            <SelectItem value="ventes">Trier par ventes validées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs agrégés */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="RDV équipe" value={teamKpis.totalRdv} icon={Calendar} />
        <StatCard label="Ventes validées" value={teamKpis.totalVentes} icon={TrendingUp} />
        <StatCard label="Tx transfo moyen" value={`${teamKpis.avgTransfo}%`} icon={Percent} />
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{estSav ? "Chef d'atelier" : 'Commercial'}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Répartition clients</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">RDV (auj / mois)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tx transfo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ventes validées</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><Loader compact /></td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {estSav ? "Aucun chef d'atelier rattaché à vos sites." : "Aucun commercial dans l'équipe."}
              </td></tr>
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
                <td className="px-4 py-3 text-sm text-foreground">
                  <span className="font-semibold">{r.nom}</span>
                  {(r.site || r.sansCompte) && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {r.site}
                      {r.sansCompte && (r.site ? ' · ' : '')}
                      {/* Un compte jamais connecté n'a aucune activité à afficher :
                          autant le dire, plutôt que de laisser croire à zéro RDV. */}
                      {r.sansCompte && <span className="text-gd-orange">compte non créé</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.totalClients > 0 ? (
                    <>
                      <div className="flex h-2 w-32 overflow-hidden rounded-full bg-muted">
                        {r.repartition.map((count, i) => count > 0 && (
                          <div key={i} className={tonaliteDe(statuts[i]?.tonalite).point} style={{ width: `${(count / r.totalClients) * 100}%` }} title={`${statuts[i]?.nom}: ${count}`} />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{r.totalClients} clients</p>
                    </>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm"><span className="font-semibold text-foreground">{r.rdvToday}</span> / <span className="text-muted-foreground">{r.rdvMonth}</span></td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{r.tauxTransfo}%</td>
                <td className="px-4 py-3 text-sm font-bold text-gd-navy">{r.ventes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}