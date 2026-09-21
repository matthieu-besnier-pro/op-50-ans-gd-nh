import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isDirection, getAppRole } from '@/lib/permissions';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import AppetenceBadge from '@/components/AppetenceBadge';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Search, Calendar, TrendingUp, Percent, PhoneCall, Target, ChevronRight, ListFilter } from 'lucide-react';
import { useDemoPersona } from '@/lib/useDemoPersona';

const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite', 'RDV obtenu', 'Prise de RDV atelier', 'Devis en cours', 'Offre magasin à proposer', 'Vente conclue', 'Refus'];
const STATUTS_TERMINAUX = ['Vente conclue', 'Refus', 'Contacté sans suite'];

export function priorityScore(client) {
  if (STATUTS_TERMINAUX.includes(client.statut)) return 0;
  let score = client.score_appetence || 0;
  if (client.statut === 'À contacter') score += 30;
  if (!client.date_dernier_contact) {
    score += 30;
  } else {
    const days = Math.floor((Date.now() - new Date(client.date_dernier_contact).getTime()) / 86400000);
    if (days > 7) score += 15;
    else if (days > 3) score += 8;
  }
  if (client.statut === 'À rappeler' && client.date_rappel) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rappel = new Date(client.date_rappel);
    if (rappel <= today) score += 40;
  }
  return Math.round(Math.min(score, 150));
}

export function priorityLabel(score) {
  if (score >= 80) return { label: 'Haute', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (score >= 40) return { label: 'Moyenne', className: 'bg-gd-orange/15 text-gd-orange border-gd-orange/30' };
  return { label: 'Normale', className: 'bg-muted text-muted-foreground border-border' };
}

export default function MonPortefeuille() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const persona = useDemoPersona();
  const [clients, setClients] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [params, setParams] = useState(null);
  const [badges, setBadges] = useState([]);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('all');
  const [sortByPriority, setSortByPriority] = useState(true);

  const effectiveId = persona.mode === 'commercial' ? persona.ids[0] : user?.id;

  const loadAll = async () => {
    setLoading(true);
    try {
      // Périmètre selon le rôle : Direction/Marketing → tous les clients ;
      // Responsable → les clients de son équipe (base_responsable_id) ;
      // Commercial → ses clients. La démo « Voir en tant que » reste prioritaire.
      const direction = isDirection(user);
      const role = getAppRole(user);
      let clientList;
      if (persona.mode === 'commercial' && persona.clientFilter) {
        clientList = await base44.entities.client.filter(persona.clientFilter, '-date_dernier_contact', 500);
      } else if (persona.mode === 'manager') {
        const all = await base44.entities.client.list('-date_dernier_contact', 2000);
        clientList = all.filter(persona.matchClient);
      } else if (direction) {
        clientList = await base44.entities.client.list('-date_dernier_contact', 5000);
      } else if (role === 'responsable') {
        clientList = await base44.entities.client.filter({ base_responsable_id: user.id }, '-date_dernier_contact', 2000);
      } else {
        clientList = await base44.entities.client.filter({ commerciaux_assignes: user.id }, '-date_dernier_contact', 2000);
      }
      setClients(clientList);

      const [rdvList, venteList, paramList, structList] = await Promise.all([
        base44.entities.rdv.list('-date_heure', 1000),
        base44.entities.vente.list('-date_vente', 1000),
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.structure_commerciale.list('-nom_commercial', 300).catch(() => [])
      ]);
      setStructure(structList);
      const scopeRdv = (r) => {
        if (persona.mode) return persona.matchCommercialId(r.commercial_id);
        if (direction) return true;
        if (role === 'responsable') return r.base_responsable_id === user.id;
        return r.commercial_id === user.id;
      };
      setRdvs(rdvList.filter(scopeRdv));
      setVentes(venteList.filter(scopeRdv));
      setParams(paramList[0] || null);

      if (!persona.mode) {
        const obtenus = await base44.entities.badge_obtenu.filter({ utilisateur_id: user.id }, '-created_date', 50);
        if (obtenus.length > 0) {
          const badgeIds = obtenus.map((o) => o.badge_id);
          const allBadges = await base44.entities.badge.list('-created_date', 50);
          setBadges(allBadges.filter((b) => badgeIds.includes(b.id)));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id || persona.mode) loadAll();
  }, [user?.id, persona.mode, persona.ids.join(',')]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Colonne « Commercial » affichée en vue manager/direction (pas pour un commercial sur son propre portefeuille)
  const showCommercial = persona.mode === 'manager' || (!persona.mode && (isDirection(user) || getAppRole(user) === 'responsable'));
  const commByUser = useMemo(() => {
    const m = {};
    structure.forEach((s) => { if (s.user_id) m[s.user_id] = s.nom_commercial; });
    return m;
  }, [structure]);
  const commercialNames = (c) => {
    const noms = (c.commerciaux_assignes || []).map((id) => commByUser[id]).filter(Boolean);
    return noms.length ? noms.join(', ') : '—';
  };

  const kpis = useMemo(() => {
    const rdvMonth = rdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure >= monthStart).length;
    const ventesValidees = ventes.filter((v) => v.statut_validation === 'Validé').length;
    const txTransfo = rdvMonth > 0 ? Math.round((ventesValidees / rdvMonth) * 100) : 0;
    const aContacter = clients.filter((c) => c.statut === 'À contacter').length;
    return { rdvMonth, ventesValidees, txTransfo, aContacter };
  }, [clients, rdvs, ventes]);

  const filtered = useMemo(() => {
    let list = clients.filter((c) => {
      if (statutFilter !== 'all' && c.statut !== statutFilter) return false;
      if (search && !(c.raison_sociale || '').toLowerCase().includes(search.toLowerCase()) && !(c.siren || '').includes(search)) return false;
      return true;
    });
    if (sortByPriority) {
      list = [...list].sort((a, b) => priorityScore(b) - priorityScore(a));
    }
    return list;
  }, [clients, search, statutFilter, sortByPriority]);

  const statutCounts = useMemo(() => {
    const counts = {};
    STATUTS.forEach((s) => counts[s] = 0);
    clients.forEach((c) => { if (counts[c.statut] !== undefined) counts[c.statut]++; });
    return counts;
  }, [clients]);

  const objRdv = params?.objectif_rdv || 0;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Mon portefeuille</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {clients.length} client{clients.length > 1 ? 's' : ''} assigné{clients.length > 1 ? 's' : ''} · {kpis.aContacter} à contacter
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="RDV réalisés (mois)" value={kpis.rdvMonth} icon={Calendar} />
        <StatCard label="Ventes validées" value={kpis.ventesValidees} icon={TrendingUp} />
        <StatCard label="Tx transformation" value={`${kpis.txTransfo}%`} icon={Percent} />
        <StatCard label="Clients à contacter" value={kpis.aContacter} icon={PhoneCall} accent />
      </div>

      {/* Progress toward objective */}
      {objRdv > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-gd-orange" /> Progression vers l'objectif RDV
            </p>
            <p className="text-sm font-bold text-gd-navy">{kpis.rdvMonth} / {objRdv}</p>
          </div>
          <ProgressBar value={kpis.rdvMonth} max={objRdv} barClassName="bg-gd-orange" />
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {badges.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-full border border-gd-orange/30 bg-gd-orange/10 px-3 py-1.5">
              <span className="text-lg">{b.icone || '🏆'}</span>
              <span className="text-sm font-semibold text-gd-navy">{b.nom}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher (raison sociale, SIREN)…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS.map((s) => (<SelectItem key={s} value={s}>{s} ({statutCounts[s] || 0})</SelectItem>))}
          </SelectContent>
        </Select>
        <Button
          variant={sortByPriority ? 'default' : 'outline'}
          onClick={() => setSortByPriority(!sortByPriority)}
          className={sortByPriority ? 'bg-gd-navy hover:bg-gd-navy-dark text-white' : 'border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white'}
        >
          <ListFilter className="h-4 w-4 mr-1.5" /> Priorité
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raison sociale</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appétence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priorité</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dernier contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prochain RDV</th>
              {showCommercial && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commercial</th>}
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showCommercial ? 8 : 7} className="px-4 py-12 text-center text-sm text-muted-foreground">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={showCommercial ? 8 : 7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {clients.length === 0
                  ? 'Aucun client assigné. L\'affectation se fera par codes communes (en cours de paramétrage).'
                  : 'Aucun client ne correspond aux filtres.'}
              </td></tr>
            ) : filtered.map((c) => {
              const prio = priorityScore(c);
              const pl = priorityLabel(prio);
              return (
                <tr key={c.id} onClick={() => navigate(`/client/${c.id}`)} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground text-sm">{c.raison_sociale}</p>
                    <p className="text-xs text-muted-foreground">{c.type_structure || 'Exploitation'} · {c.siren || '—'}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge statut={c.statut} /></td>
                  <td className="px-4 py-3"><AppetenceBadge niveau={c.niveau_appetence} score={c.score_appetence} /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pl.className}`}>
                      {pl.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.date_dernier_contact || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.date_prochain_rdv || '—'}</td>
                  {showCommercial && <td className="px-4 py-3 text-sm text-foreground">{commercialNames(c)}</td>}
                  <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}