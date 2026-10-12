import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Loader from '@/components/Loader';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isDirection, getAppRole } from '@/lib/permissions';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import AppetenceGauge from '@/components/AppetenceGauge';
import { UsagesClient } from '@/components/MaterielPicto';
import ParcPictos from '@/components/ParcPictos';
import { useOperationStats } from '@/lib/useOperationStats';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Percent, PhoneCall, Target, ChevronRight, Star, Phone, CalendarPlus } from 'lucide-react';
import PortefeuilleFiltres from '@/components/PortefeuilleFiltres';
import { useDemoPersona } from '@/lib/useDemoPersona';
import RdvExpress from '@/components/RdvExpress';

const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite', 'RDV obtenu', 'Prise de RDV atelier', 'Devis en cours', 'Offre magasin à proposer', 'Vente conclue', 'Refus'];
const FILTRES_INIT = {
  search: '',
  statut: 'all',
  appetence: 'all',
  commercial: 'all',
  suivi: 'all'
};

// Numéro à appeler en priorité (mobile, sinon fixe).
function telClient(c) {
  return c.tel_mobile || c.tel_fixe || null;
}

// Niveau d'appétence du client (mêmes seuils que la jauge AppetenceGauge).
export function niveauAppetence(client) {
  if (client.niveau_appetence) return client.niveau_appetence;
  const s = client.score_appetence;
  if (s == null) return null;
  if (s >= 66) return 'Fort';
  if (s >= 36) return 'Moyen';
  return 'Faible';
}

export default function MonPortefeuille() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const persona = useDemoPersona();
  const stats = useOperationStats();
  const [clients, setClients] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [params, setParams] = useState(null);
  const [badges, setBadges] = useState([]);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(FILTRES_INIT);
  const [sortByPriority, setSortByPriority] = useState(true);
  const [prioriteOnly, setPrioriteOnly] = useState(false);
  const [rdvClient, setRdvClient] = useState(null);
  const [rdvOpen, setRdvOpen] = useState(false);

  const effectiveId = persona.mode === 'commercial' ? persona.ids[0] : user?.id;

  // Périmètre des RDV/ventes : persona « Voir en tant que » prioritaire, sinon rôle réel.
  const rdvScope = useCallback((r) => {
    if (persona.mode) return persona.matchCommercialId(r.commercial_id);
    if (isDirection(user)) return true;
    if (getAppRole(user) === 'responsable') return r.base_responsable_id === user?.id;
    return r.commercial_id === user?.id;
  }, [user, persona.mode, persona.ids.join(',')]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Démo « Voir en tant que » prioritaire ; sinon on passe par la fonction backend
      // lister_clients (asServiceRole) qui scope par rôle et garantit la remontée
      // (Direction/Marketing = tous, Responsable = son équipe, Commercial = les siens).
      let clientList;
      if (persona.mode === 'commercial' && persona.clientFilter) {
        // Portefeuille du commercial (rattachement par secteur) : chargé en entier.
        clientList = await base44.entities.client.filter(persona.clientFilter, '-created_date', 2000);
      } else if (persona.mode === 'manager') {
        // Équipe du manager : tous ses secteurs d'un coup, sans troncature.
        clientList = persona.clientFilter
          ? await base44.entities.client.filter(persona.clientFilter, '-created_date', 5000)
          : [];
      } else {
        const res = await base44.functions.invoke('lister_clients', {});
        clientList = (res?.data?.clients) || [];
      }
      setClients(clientList);

      const [rdvList, venteList, paramList, structList] = await Promise.all([
        base44.entities.rdv.list('-date_heure', 1000),
        base44.entities.vente.list('-date_vente', 1000),
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.structure_commerciale.list('-nom_commercial', 300).catch(() => [])
      ]);
      setStructure(structList);
      setRdvs(rdvList.filter(rdvScope));
      setVentes(venteList.filter(rdvScope));
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

  // Après un RDV pris depuis la liste : on rafraîchit les RDV et la ligne du client.
  const reloadApresRdv = async () => {
    const [rdvList, maj] = await Promise.all([
      base44.entities.rdv.list('-date_heure', 1000),
      rdvClient?.id ? base44.entities.client.get(rdvClient.id).catch(() => null) : Promise.resolve(null)
    ]);
    setRdvs(rdvList.filter(rdvScope));
    if (maj) setClients((list) => list.map((c) => (c.id === maj.id ? { ...c, ...maj } : c)));
  };

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
    if (noms.length) return noms.join(', ');
    // Repli : nom du commercial issu des fichiers d'import (champ « secteur vendeur »)
    return c.secteur || '—';
  };

  // Options du filtre « commercial » : commerciaux assignés, complétés par les noms
  // issus des fichiers d'import pour les clients non encore rattachés à un compte.
  const commercialOptions = useMemo(() => {
    const opts = [];
    const seen = new Set();
    clients.forEach((c) => {
      (c.commerciaux_assignes || []).forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        opts.push({ value: id, label: commByUser[id] || 'Commercial' });
      });
    });
    clients.forEach((c) => {
      const assigned = c.commerciaux_assignes || [];
      if (assigned.length === 0 && c.secteur && !seen.has(`secteur:${c.secteur}`)) {
        seen.add(`secteur:${c.secteur}`);
        opts.push({ value: `secteur:${c.secteur}`, label: `${c.secteur} (import)` });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [clients, commByUser]);



  // Chiffres exacts (comptages serveur) ; repli sur les listes chargées en attendant.
  const kpis = useMemo(() => {
    const rdvMonth = stats?.rdv?.pris_du_mois ?? rdvs.filter((r) => r.statut !== 'Annulé' && r.date_heure >= monthStart).length;
    const ventesValidees = stats?.ventes?.validees ?? ventes.filter((v) => v.statut_validation === 'Validé').length;
    const txTransfo = rdvMonth > 0 ? Math.round((ventesValidees / rdvMonth) * 100) : 0;
    const aContacter = stats?.clients?.par_statut?.['À contacter'] ?? clients.filter((c) => c.statut === 'À contacter').length;
    const totalClients = stats?.clients?.total ?? clients.length;
    return { rdvMonth, ventesValidees, txTransfo, aContacter, totalClients };
  }, [clients, rdvs, ventes, stats, monthStart]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let list = clients.filter((c) => {
      if (prioriteOnly && !c.priorite_commercial) return false;
      if (filters.statut !== 'all' && c.statut !== filters.statut) return false;

      if (filters.appetence !== 'all' && niveauAppetence(c) !== filters.appetence) return false;

      if (filters.commercial !== 'all') {
        const assigned = c.commerciaux_assignes || [];
        if (filters.commercial.startsWith('secteur:')) {
          if (assigned.length > 0 || c.secteur !== filters.commercial.slice(8)) return false;
        } else if (!assigned.includes(filters.commercial)) return false;
      }

      if (filters.suivi !== 'all') {
        if (filters.suivi === 'rdv') {
          const next = c.date_prochain_rdv ? new Date(c.date_prochain_rdv) : null;
          if (!next || next < today) return false;
        }
        if (filters.suivi === 'rappel') {
          const rappel = c.date_rappel ? new Date(c.date_rappel) : null;
          if (c.statut !== 'À rappeler' || !rappel || rappel > today) return false;
        }
      }

      if (filters.search) {
        const s = filters.search.toLowerCase();
        const hay = [c.raison_sociale, c.siren, c.code_commune, c.adresse_complete, c.secteur, commercialNames(c)]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }

      return true;
    });
    // Les cibles choisies par le commercial remontent toujours en tête.
    list = [...list].sort((a, b) => {
      const pa = a.priorite_commercial ? 1 : 0;
      const pb = b.priorite_commercial ? 1 : 0;
      if (pa !== pb) return pb - pa;
      if (sortByPriority) return (b.score_appetence || 0) - (a.score_appetence || 0);
      return 0;
    });
    return list;
  }, [clients, filters, sortByPriority, prioriteOnly, commByUser, structure]);

  const statutCounts = useMemo(() => {
    const counts = {};
    const exacts = stats?.clients?.par_statut;
    STATUTS.forEach((s) => { counts[s] = exacts ? (exacts[s] || 0) : 0; });
    if (!exacts) clients.forEach((c) => { if (counts[c.statut] !== undefined) counts[c.statut]++; });
    return counts;
  }, [clients, stats]);

  const [affichesMax, setAffichesMax] = useState(200);
  useEffect(() => { setAffichesMax(200); }, [filters, sortByPriority, prioriteOnly]);
  const nbPriorites = useMemo(() => clients.filter((c) => c.priorite_commercial).length, [clients]);
  const affiches = filtered.slice(0, affichesMax);

  const objRdv = params?.objectif_rdv || 0;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Mes clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {kpis.totalClients.toLocaleString('fr-FR')} client{kpis.totalClients > 1 ? 's' : ''} assigné{kpis.totalClients > 1 ? 's' : ''} · {kpis.aContacter.toLocaleString('fr-FR')} à contacter
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="RDV pris (mois)" value={kpis.rdvMonth} icon={Calendar} />
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

      {/* Filtres du portefeuille */}
      <PortefeuilleFiltres
        filters={filters}
        onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        onReset={() => setFilters(FILTRES_INIT)}
        statutCounts={statutCounts}
        commercials={commercialOptions}
        showCommercial={showCommercial}
        sortByAppetence={sortByPriority}
        onToggleSort={() => setSortByPriority((v) => !v)}
        count={filtered.length}
        total={clients.length}
      />

      {nbPriorites > 0 && (
        <div className="mb-4">
          <Button
            variant={prioriteOnly ? 'default' : 'outline'}
            onClick={() => setPrioriteOnly((v) => !v)}
            className={prioriteOnly ? 'bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark' : 'border-gd-orange text-gd-orange hover:bg-gd-orange hover:text-gd-navy-dark'}
          >
            <Star className="h-4 w-4 mr-1.5" fill="currentColor" /> Mes cibles prioritaires ({nbPriorites})
          </Button>
        </div>
      )}

      {kpis.totalClients > clients.length && (
        <p className="mb-2 text-xs text-muted-foreground">
          {clients.length.toLocaleString('fr-FR')} clients chargés sur {kpis.totalClients.toLocaleString('fr-FR')} — la recherche et les filtres portent sur les clients affichés.
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raison sociale</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Téléphone</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Parc cible</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Appétence</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Prochain RDV</th>
              {showCommercial && <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Commercial</th>}
              <th className="px-4 py-3 w-44"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showCommercial ? 9 : 8}><Loader compact /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={showCommercial ? 9 : 8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {clients.length === 0
                  ? 'Aucun client ne vous est affecté pour l\'instant. L\'affectation est gérée par la Direction (Administration → Affectation).'
                  : 'Aucun client ne correspond aux filtres.'}
              </td></tr>
            ) : affiches.map((c) => {
              return (
                <tr key={c.id} onClick={() => navigate(`/client/${c.id}`)} className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${c.priorite_commercial ? 'bg-gd-orange/5' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      {c.priorite_commercial && <Star className="h-3.5 w-3.5 shrink-0 text-gd-orange" fill="currentColor" aria-label="Cible prioritaire" />}
                      {c.raison_sociale}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.type_structure || 'Exploitation'} · {c.siren || '—'}</p>
                    {Array.isArray(c.usages) && c.usages.length > 0 && <UsagesClient usages={c.usages} className="mt-1" />}
                    {/* Tablette / petit écran : le parc remonte sous le nom (sa colonne dédiée revient en grand écran) */}
                    <div className="mt-1.5 xl:hidden"><ParcPictos pictos={c.parc_pictos} /></div>
                  </td>
                  <td className="px-4 py-3">
                    {telClient(c) ? (
                      <a
                        href={`tel:${telClient(c).replace(/[^+\d]/g, '')}`}
                        onClick={(e) => e.stopPropagation()}
                        className="-mx-1 -my-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-gd-navy hover:bg-gd-orange/10 hover:text-gd-orange whitespace-nowrap"
                      >
                        <Phone className="h-4 w-4 xl:h-3.5 xl:w-3.5" />{telClient(c)}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 xl:table-cell"><ParcPictos pictos={c.parc_pictos} /></td>
                  <td className="px-4 py-3"><StatusBadge statut={c.statut} /></td>
                  <td className="hidden px-4 py-3 xl:table-cell"><AppetenceGauge niveau={c.niveau_appetence} score={c.score_appetence} /></td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground xl:table-cell">{c.date_prochain_rdv || '—'}</td>
                  {showCommercial && <td className="hidden px-4 py-3 text-sm text-foreground xl:table-cell">{commercialNames(c)}</td>}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => { setRdvClient(c); setRdvOpen(true); }}
                        className="h-10 bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark font-semibold whitespace-nowrap xl:h-8"
                      >
                        <CalendarPlus className="h-4 w-4 mr-1.5 xl:h-3.5 xl:w-3.5" /> Ajout RDV
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > affiches.length && (
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <Button
            variant="outline"
            onClick={() => setAffichesMax((n) => n + 500)}
            className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white"
          >
            Afficher 500 clients de plus
          </Button>
          <p className="text-xs text-muted-foreground">
            {affiches.length.toLocaleString('fr-FR')} affichés sur {filtered.length.toLocaleString('fr-FR')}
          </p>
        </div>
      )}
      <RdvExpress
        open={rdvOpen}
        onOpenChange={setRdvOpen}
        client={rdvClient}
        commercialId={effectiveId}
        onSaved={reloadApresRdv}
      />
    </Layout>
  );
}