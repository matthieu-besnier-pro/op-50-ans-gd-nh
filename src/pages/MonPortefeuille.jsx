import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Loader from '@/components/Loader';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { listerPartage, invalider } from '@/lib/donneesPartagees';
import { useAuth } from '@/lib/AuthContext';
import { isDirection, getAppRole } from '@/lib/permissions';
import Layout from '@/components/Layout';
import AppetenceGauge from '@/components/AppetenceGauge';
import { UsagesClient, SourcesAgriPrecision, categorieMeta } from '@/components/MaterielPicto';
import ParcPictos from '@/components/ParcPictos';
import { useOperationStats } from '@/lib/useOperationStats';
import StatCard from '@/components/StatCard';
import ProgressBar from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Percent, PhoneCall, Target, ChevronRight, Star, CalendarPlus, UserPlus, CalendarCheck, X, Loader2 } from 'lucide-react';
import PortefeuilleFiltres from '@/components/PortefeuilleFiltres';
import StatutInline from '@/components/StatutInline';
import { useDemoPersona } from '@/lib/useDemoPersona';
import RdvExpress from '@/components/RdvExpress';
import TelephoneClient from '@/components/TelephoneClient';
import AjouterClientDialog from '@/components/AjouterClientDialog';
import { villeClientTexte } from '@/lib/localisationClient';
import { useStatuts } from '@/lib/statuts';

const FILTRES_INIT = {
  search: '',
  statut: 'all',
  appetence: 'all',
  commercial: 'all',
  suivi: 'all',
  parc: 'all'
};

// Catégories de machines présentes dans le parc d'un client (« TRACTEURS:3 »).
const categoriesDuParc = (client) =>
  (client.parc_pictos || [])
    .map((p) => { const [cat, n] = String(p).split(':'); return (Number(n) || 0) > 0 ? cat : null; })
    .filter(Boolean);

// Dates de rendez-vous : court pour le bouton, long pour la confirmation d'annulation.
const formatRdvCourt = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const formatRdvLong = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return 'ce rendez-vous';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

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
  // Liste des statuts administrée par la Direction (Administration → Statuts).
  const statuts = useStatuts();
  const [clients, setClients] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [params, setParams] = useState(null);
  const [badges, setBadges] = useState([]);
  const [structure, setStructure] = useState([]);
  const [perimetre, setPerimetre] = useState(null); // chef d'atelier / responsable SAV : périmètre renvoyé par le serveur
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(FILTRES_INIT);
  const [sortByPriority, setSortByPriority] = useState(true);
  const [prioriteOnly, setPrioriteOnly] = useState(false);
  const [rdvClient, setRdvClient] = useState(null);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [ajoutOpen, setAjoutOpen] = useState(false);
  const [annulationId, setAnnulationId] = useState(null);

  const effectiveId = persona.mode === 'commercial' ? persona.ids[0] : user?.id;

  // Périmètre des RDV/ventes : persona « Voir en tant que » prioritaire, sinon rôle réel.
  const rdvScope = useCallback((r) => {
    if (persona.mode) return persona.matchCommercialId(r.commercial_id);
    if (isDirection(user)) return true;
    if (getAppRole(user) === 'responsable') return r.base_responsable_id === user?.id;
    // Chef d'atelier / responsable SAV : les RDV des commerciaux de ses sites.
    if (perimetre) return (perimetre.commercial_ids || []).includes(r.commercial_id);
    return r.commercial_id === user?.id;
  }, [user, persona.mode, persona.ids.join(','), perimetre]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Démo « Voir en tant que » prioritaire ; sinon on passe par la fonction backend
      // lister_clients (asServiceRole) qui scope par rôle et garantit la remontée
      // (Direction/Marketing = tous, Responsable = son équipe, Commercial = les siens).
      let clientList;
      let scopeFrais = null;
      if (persona.mode === 'commercial' && persona.clientFilter) {
        // Portefeuille du commercial (rattachement par secteur) : chargé en entier.
        clientList = await base44.entities.client.filter(persona.clientFilter, '-created_date', 2000);
      } else if (persona.mode === 'manager' || persona.mode === 'atelier') {
        // Équipe du manager / sites du référent d'atelier : tout le périmètre d'un coup.
        clientList = persona.clientFilter
          ? await base44.entities.client.filter(persona.clientFilter, '-created_date', 5000)
          : [];
        setPerimetre(null);
      } else {
        const res = await base44.functions.invoke('lister_clients', {});
        clientList = (res?.data?.clients) || [];
        scopeFrais = res?.data?.scope || null;
        setPerimetre(scopeFrais);
      }
      setClients(clientList);
      // Le périmètre vient d'être lu par le serveur : on l'applique aux RDV et ventes
      // dans la foulée (le state n'est pas encore disponible dans ce rendu).
      const dansPortee = (r) => (scopeFrais ? (scopeFrais.commercial_ids || []).includes(r.commercial_id) : rdvScope(r));

      const [rdvList, venteList, paramList, structList] = await Promise.all([
        listerPartage('rdv', '-date_heure', 1000),
        listerPartage('vente', '-date_vente', 1000),
        listerPartage('parametres_operation', '-created_date', 1),
        listerPartage('structure_commerciale', '-nom_commercial', 300).catch(() => [])
      ]);
      setStructure(structList);
      setRdvs(rdvList.filter(dansPortee));
      setVentes(venteList.filter(dansPortee));
      setParams(paramList[0] || null);

      if (!persona.mode) {
        const obtenus = await base44.entities.badge_obtenu.filter({ utilisateur_id: user.id }, '-created_date', 50);
        if (obtenus.length > 0) {
          const badgeIds = obtenus.map((o) => o.badge_id);
          const allBadges = await listerPartage('badge', '-created_date', 50);
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

  // Statut changé directement dans la liste : on met à jour la ligne sans recharger.
  const majClient = (maj) => {
    setClients((list) => list.map((c) => (c.id === maj.id ? { ...c, ...maj } : c)));
  };

  // Annulation d'un rendez-vous depuis la liste : on garde la trace (statut « Annulé »)
  // et on libère le client pour qu'un nouveau rendez-vous puisse être posé.
  const annulerRdv = async (rdv, client) => {
    if (!window.confirm(`Annuler le rendez-vous du ${formatRdvLong(rdv.date_heure)} avec ${client.raison_sociale} ?`)) return;
    setAnnulationId(rdv.id);
    try {
      await base44.entities.rdv.update(rdv.id, { statut: 'Annulé' });
      invalider('rdv');
      setRdvs((list) => list.map((r) => (r.id === rdv.id ? { ...r, statut: 'Annulé' } : r)));
      // Les badges se recalculent : un badge décroché grâce à ce RDV doit retomber.
      if (rdv.commercial_id) {
        base44.functions.invoke('verifier_badges', { utilisateur_id: rdv.commercial_id }).catch(() => {});
      }
      if (client.date_prochain_rdv) {
        await base44.entities.client.update(client.id, { date_prochain_rdv: null }).catch(() => {});
        majClient({ ...client, date_prochain_rdv: null });
      }
    } catch (e) {
      console.error(e);
      window.alert("L'annulation n'a pas pu être enregistrée.");
    } finally {
      setAnnulationId(null);
    }
  };

  // Après un RDV pris depuis la liste : on rafraîchit les RDV et la ligne du client.
  const reloadApresRdv = async () => {
    const [rdvList, maj] = await Promise.all([
      listerPartage('rdv', '-date_heure', 1000),
      rdvClient?.id ? base44.entities.client.get(rdvClient.id).catch(() => null) : Promise.resolve(null)
    ]);
    setRdvs(rdvList.filter(rdvScope));
    if (maj) setClients((list) => list.map((c) => (c.id === maj.id ? { ...c, ...maj } : c)));
  };

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Colonne « Commercial » affichée en vue manager/direction (pas pour un commercial sur son propre portefeuille)
  const showCommercial = !!perimetre || persona.mode === 'manager' || persona.mode === 'atelier' || (!persona.mode && (isDirection(user) || getAppRole(user) === 'responsable'));
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
    const rdvMonth = stats?.rdv?.operation?.pris ?? stats?.rdv?.pris_du_mois ?? rdvs.filter((r) => r.statut !== 'Annulé' && r.date_heure >= monthStart).length;
    const ventesValidees = stats?.ventes?.validees ?? ventes.filter((v) => v.statut_validation === 'Validé').length;
    // Le taux compare la MÊME période des deux côtés : des ventes de toujours
    // rapportées aux RDV du mois donnaient un pourcentage faux (parfois > 100 %).
    const moisJour = monthStart.slice(0, 10);
    const ventesMois = stats?.ventes?.validees_operation ?? stats?.ventes?.validees_du_mois
      ?? ventes.filter((v) => v.statut_validation === 'Validé' && v.date_vente >= moisJour).length;
    const txTransfo = rdvMonth > 0 ? Math.round((ventesMois / rdvMonth) * 100) : 0;
    const aContacter = stats?.clients?.par_statut?.['À contacter'] ?? clients.filter((c) => c.statut === 'À contacter').length;
    const totalClients = stats?.clients?.total ?? clients.length;
    return { rdvMonth, ventesValidees, ventesMois, txTransfo, aContacter, totalClients };
  }, [clients, rdvs, ventes, stats, monthStart]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let list = clients.filter((c) => {
      if (prioriteOnly && !c.priorite_commercial) return false;

      // Parc cible : ne garder que les clients possédant ce type de machine.
      if (filters.parc !== 'all' && !categoriesDuParc(c).includes(filters.parc)) return false;
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
    // Nombre de machines d'une catégorie donnée (pour trier par parc cible).
    const nbDansCategorie = (c, cat) => {
      const trouve = (c.parc_pictos || []).find((p) => String(p).split(':')[0] === cat);
      return trouve ? (Number(String(trouve).split(':')[1]) || 0) : 0;
    };

    // Les cibles choisies par le commercial remontent toujours en tête.
    list = [...list].sort((a, b) => {
      const pa = a.priorite_commercial ? 1 : 0;
      const pb = b.priorite_commercial ? 1 : 0;
      if (pa !== pb) return pb - pa;
      // Parc cible sélectionné : les plus gros parcs de ce type d'abord.
      if (filters.parc !== 'all') {
        const ecart = nbDansCategorie(b, filters.parc) - nbDansCategorie(a, filters.parc);
        if (ecart !== 0) return ecart;
      }
      if (sortByPriority) return (b.score_appetence || 0) - (a.score_appetence || 0);
      return 0;
    });
    return list;
  }, [clients, filters, sortByPriority, prioriteOnly, commByUser, structure]);

  const statutCounts = useMemo(() => {
    const counts = {};
    const exacts = stats?.clients?.par_statut;
    statuts.forEach((s) => { counts[s.nom] = exacts ? (exacts[s.nom] || 0) : 0; });
    if (!exacts) clients.forEach((c) => { if (counts[c.statut] !== undefined) counts[c.statut]++; });
    return counts;
  }, [clients, stats, statuts]);

  const [affichesMax, setAffichesMax] = useState(200);
  useEffect(() => { setAffichesMax(200); }, [filters, sortByPriority, prioriteOnly]);
  const nbPriorites = useMemo(() => clients.filter((c) => c.priorite_commercial).length, [clients]);

  // Catégories proposées au filtre « Parc cible » : seulement celles réellement
  // présentes, avec le nombre de clients qui en possèdent.
  const parcOptions = useMemo(() => {
    const compte = {};
    clients.forEach((c) => {
      new Set(categoriesDuParc(c)).forEach((cat) => { compte[cat] = (compte[cat] || 0) + 1; });
    });
    return Object.entries(compte)
      .map(([value, nb]) => ({ value, nb, label: categorieMeta(value).label, emoji: categorieMeta(value).emoji }))
      .sort((a, b) => b.nb - a.nb);
  }, [clients]);

  // Rendez-vous à venir par client (le plus proche, non annulé) : pilote l'état du bouton.
  const rdvParClient = useMemo(() => {
    const maintenant = Date.now();
    const m = {};
    rdvs.forEach((r) => {
      if (!r.client_id || r.statut === 'Annulé') return;
      const t = r.date_heure ? new Date(r.date_heure).getTime() : NaN;
      if (isNaN(t) || t < maintenant) return;
      const actuel = m[r.client_id];
      if (!actuel || t < new Date(actuel.date_heure).getTime()) m[r.client_id] = r;
    });
    return m;
  }, [rdvs]);
  const affiches = filtered.slice(0, affichesMax);

  const objRdv = params?.objectif_rdv || 0;
  const sitesAtelier = persona.mode === 'atelier' ? (persona.sites || []) : (perimetre?.sites || []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Mes clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {kpis.totalClients.toLocaleString('fr-FR')} client{kpis.totalClients > 1 ? 's' : ''} assigné{kpis.totalClients > 1 ? 's' : ''} · {kpis.aContacter.toLocaleString('fr-FR')} à contacter
        </p>
        {sitesAtelier.length > 0 && (
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gd-navy/70">
            {persona.mode === 'atelier' && persona.label ? `${persona.label} · ` : ''}Atelier{sitesAtelier.length > 1 ? 's' : ''} : {sitesAtelier.join(' · ')}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="RDV pris" value={kpis.rdvMonth} icon={Calendar} />
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
        parcOptions={parcOptions}
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

      {/* Ajout manuel d'un client absent de la liste */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Listing clients
        </p>
        <Button
          onClick={() => setAjoutOpen(true)}
          className="bg-gd-navy text-white hover:bg-gd-navy/90 font-semibold"
        >
          <UserPlus className="h-4 w-4 mr-1.5" /> Ajouter un client
        </Button>
      </div>

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
              <th className="px-4 py-3 w-52"></th>
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
              const loc = villeClientTexte(c);
              const rdvPris = rdvParClient[c.id];
              return (
                <tr key={c.id} onClick={() => navigate(`/client/${c.id}`)} className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${c.priorite_commercial ? 'bg-gd-orange/5' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground text-sm flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      {c.priorite_commercial && <Star className="h-3.5 w-3.5 shrink-0 text-gd-orange" fill="currentColor" aria-label="Cible prioritaire" />}
                      {c.raison_sociale}
                      {loc && <span className="text-xs font-normal text-muted-foreground">· {loc}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.type_structure || 'Exploitation'} · {c.siren || '—'}</p>
                    {Array.isArray(c.usages) && c.usages.length > 0 && <UsagesClient usages={c.usages} className="mt-1" />}
                    <SourcesAgriPrecision sources={c.sources_agri_precision} className="mt-1" />
                    {/* Tablette / petit écran : le parc remonte sous le nom (sa colonne dédiée revient en grand écran) */}
                    <div className="mt-1.5 xl:hidden"><ParcPictos pictos={c.parc_pictos} /></div>
                  </td>
                  <td className="px-4 py-3"><TelephoneClient client={c} /></td>
                  <td className="hidden px-4 py-3 xl:table-cell"><ParcPictos pictos={c.parc_pictos} /></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <StatutInline client={c} user={user} onSaved={majClient} />
                  </td>
                  <td className="hidden px-4 py-3 xl:table-cell"><AppetenceGauge niveau={c.niveau_appetence} score={c.score_appetence} /></td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground xl:table-cell">{c.date_prochain_rdv || '—'}</td>
                  {showCommercial && <td className="hidden px-4 py-3 text-sm text-foreground xl:table-cell">{commercialNames(c)}</td>}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {rdvPris ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              title={`Rendez-vous ${formatRdvLong(rdvPris.date_heure)}`}
                              className="inline-flex h-9 cursor-default items-center rounded-md bg-muted px-3 text-sm font-semibold text-muted-foreground whitespace-nowrap xl:h-8"
                            >
                              <CalendarCheck className="mr-1.5 h-4 w-4 xl:h-3.5 xl:w-3.5" />
                              RDV {formatRdvCourt(rdvPris.date_heure)}
                            </span>
                            <button
                              type="button"
                              onClick={() => annulerRdv(rdvPris, c)}
                              disabled={annulationId === rdvPris.id}
                              title="Annuler le rendez-vous"
                              aria-label="Annuler le rendez-vous"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-gd-red hover:bg-gd-red/10 hover:text-gd-red disabled:opacity-50"
                            >
                              {annulationId === rdvPris.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <X className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          {/* Un client peut avoir un RDV matériel ET un RDV atelier. */}
                          <button
                            type="button"
                            onClick={() => { setRdvClient(c); setRdvOpen(true); }}
                            className="inline-flex h-7 items-center rounded-md border border-gd-orange/50 px-2 text-xs font-semibold text-gd-orange whitespace-nowrap transition hover:bg-gd-orange hover:text-gd-navy-dark"
                          >
                            <CalendarPlus className="mr-1 h-3 w-3" /> Autre RDV
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => { setRdvClient(c); setRdvOpen(true); }}
                          className="h-10 bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark font-semibold whitespace-nowrap xl:h-8"
                        >
                          <CalendarPlus className="h-4 w-4 mr-1.5 xl:h-3.5 xl:w-3.5" /> Ajout RDV
                        </Button>
                      )}
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
      <AjouterClientDialog
        open={ajoutOpen}
        onOpenChange={setAjoutOpen}
        commercials={commercialOptions.filter((o) => !String(o.value).startsWith('secteur:'))}
        onCreated={(client) => client && setClients((l) => [client, ...l])}
      />
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