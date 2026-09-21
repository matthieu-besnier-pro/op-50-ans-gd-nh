import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import RdvExpress from '@/components/RdvExpress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Trophy, Award, Flame, Zap, Lock, Check, X, CalendarPlus, ChevronRight,
  Phone, Star, Clock, Briefcase
} from 'lucide-react';

function ProgressRing({ value, max, label, sublabel, color = '#FFC107' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 48;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
          <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 5px ${color}55)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-white tabular-nums">{value}</span>
          {max > 0 && <span className="text-[10px] text-white/50">/ {max}</span>}
        </div>
      </div>
      <span className="mt-1 text-xs font-semibold text-white/90">{label}</span>
      {sublabel && <span className="text-[10px] text-white/40">{sublabel}</span>}
    </div>
  );
}

const NIVEAU_RANG = { Fort: 0, Moyen: 1, Faible: 2 };

export default function EspaceCommercial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useState(null);
  const [rdvs, setRdvs] = useState([]);          // mes RDV
  const [allRdvs, setAllRdvs] = useState([]);    // équipe (pour le rang)
  const [allVentes, setAllVentes] = useState([]);
  const [clients, setClients] = useState([]);    // mes clients
  const [badges, setBadges] = useState([]);
  const [obtenus, setObtenus] = useState([]);
  const [nbCommerciaux, setNbCommerciaux] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [rdvOpen, setRdvOpen] = useState(false);
  const [updatingRdv, setUpdatingRdv] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, myRdv, myClients, b, aRdv, aVentes, users] = await Promise.all([
          base44.entities.parametres_operation.list('-created_date', 1),
          base44.entities.rdv.filter({ commercial_id: user.id }, '-date_heure', 500).catch(() => []),
          base44.entities.client.filter({ commerciaux_assignes: user.id }, '-date_dernier_contact', 500).catch(() => []),
          base44.entities.badge.list('-created_date', 50),
          base44.entities.rdv.list('-date_heure', 1000).catch(() => []),
          base44.entities.vente.list('-date_vente', 1000).catch(() => []),
          base44.entities.User.list('-created_date', 300).catch(() => [])
        ]);
        setParams(p[0] || null);
        setRdvs(myRdv);
        setClients(myClients);
        setBadges(b);
        setAllRdvs(aRdv);
        setAllVentes(aVentes);
        setNbCommerciaux(Math.max(1, users.filter((u) => u.app_role === 'commercial').length));
        try {
          const ob = await base44.entities.badge_obtenu.filter({ utilisateur_id: user.id }, '-created_date', 200);
          setObtenus(ob);
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const rdvRealises = rdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure >= monthStart).length;
    const myVentes = allVentes.filter((v) => v.commercial_id === user.id && v.statut_validation === 'Validé').length;
    const aContacter = clients.filter((c) => c.statut === 'À contacter').length;
    return { rdvRealises, myVentes, aContacter };
  }, [rdvs, allVentes, clients, user.id]);

  // Objectifs individuels = part de l'objectif global / nb de commerciaux
  const objRdvIndiv = params?.objectif_rdv ? Math.max(1, Math.round(params.objectif_rdv / nbCommerciaux)) : 0;
  const objVentesIndiv = params?.objectif_ventes ? Math.max(1, Math.round(params.objectif_ventes / nbCommerciaux)) : 0;

  // Mon rang dans l'équipe (RDV réalisés = 1 pt, vente validée = 3 pts)
  const monRang = useMemo(() => {
    const byUser = {};
    allRdvs.forEach((r) => { if (r.statut === 'Réalisé') byUser[r.commercial_id] = (byUser[r.commercial_id] || 0) + 1; });
    allVentes.forEach((v) => { if (v.statut_validation === 'Validé') byUser[v.commercial_id] = (byUser[v.commercial_id] || 0) + 3; });
    const classement = Object.entries(byUser).map(([uid, score]) => ({ uid, score })).sort((a, b) => b.score - a.score);
    const idx = classement.findIndex((e) => e.uid === user.id);
    return { rang: idx >= 0 ? idx + 1 : null, total: Math.max(classement.length, nbCommerciaux), score: byUser[user.id] || 0 };
  }, [allRdvs, allVentes, user.id, nbCommerciaux]);

  // Mes priorités du jour : à rappeler aujourd'hui, puis appétence Fort/Moyen non traités
  const priorites = useMemo(() => {
    const aRappeler = clients.filter((c) => c.statut === 'À rappeler' && c.date_rappel && c.date_rappel <= todayStr);
    const aTraiter = clients
      .filter((c) => ['À contacter', 'Injoignable'].includes(c.statut))
      .sort((a, b) => (NIVEAU_RANG[a.niveau_appetence] ?? 3) - (NIVEAU_RANG[b.niveau_appetence] ?? 3) || (b.score_appetence || 0) - (a.score_appetence || 0));
    return [...aRappeler, ...aTraiter].slice(0, 6);
  }, [clients]);

  const upcomingRdvs = useMemo(() => {
    const now = new Date().toISOString();
    return rdvs.filter((r) => r.statut === 'Planifié' && r.date_heure >= now)
      .sort((a, b) => a.date_heure.localeCompare(b.date_heure)).slice(0, 5);
  }, [rdvs]);

  const obtainedIds = useMemo(() => new Set(obtenus.map((o) => o.badge_id)), [obtenus]);
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const updateRdvStatus = async (rdvId, statut) => {
    setUpdatingRdv(rdvId);
    try {
      await base44.entities.rdv.update(rdvId, { statut });
      setRdvs((prev) => prev.map((r) => (r.id === rdvId ? { ...r, statut } : r)));
    } catch (e) { console.error(e); }
    finally { setUpdatingRdv(null); }
  };
  const reloadRdvs = async () => {
    try { setRdvs(await base44.entities.rdv.filter({ commercial_id: user.id }, '-date_heure', 500)); } catch (e) { /* ignore */ }
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div></Layout>;
  }

  const prenom = (user.full_name || '').split(' ')[0] || 'à vous';
  const daysLeft = params?.date_debut_operation
    ? Math.max(0, Math.ceil((new Date(params.date_debut_operation).getTime() - Date.now()) / 86400000)) : 0;
  const niveauBadge = (n) => n === 'Fort' ? 'bg-emerald-500/20 text-emerald-300' : n === 'Moyen' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/50';

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] rounded-2xl gd-gradient p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-gd-orange" /> Bonjour {prenom}
            </h1>
            <p className="text-xs text-white/50">Votre espace — 50 ans Gonnin Duris × New Holland</p>
          </div>
          <div className="flex items-center gap-3">
            {monRang.rang && (
              <div className="flex flex-col items-center rounded-xl bg-gd-orange/15 border border-gd-orange/30 px-5 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gd-orange">Mon rang</span>
                <span className="text-2xl font-extrabold text-white tabular-nums">#{monRang.rang}<span className="text-sm text-white/40"> / {monRang.total}</span></span>
              </div>
            )}
            <div className="flex flex-col items-center rounded-xl bg-white/5 border border-white/10 px-5 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gd-orange">Avant l'opération</span>
              <span className="text-2xl font-extrabold text-white tabular-nums">J-{daysLeft}</span>
            </div>
          </div>
        </div>

        {/* Anneaux */}
        <div className="flex items-center justify-around rounded-xl bg-white/5 border border-white/10 py-3">
          <ProgressRing value={stats.rdvRealises} max={objRdvIndiv} label="Mes RDV réalisés" sublabel="ce mois" color="#FFC107" />
          <ProgressRing value={stats.myVentes} max={objVentesIndiv} label="Mes ventes" sublabel="validées" color="#4ADE80" />
          <ProgressRing value={stats.aContacter} max={0} label="À contacter" sublabel="dans mon portefeuille" color="#60A5FA" />
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="h-8 w-64 border-white/10 bg-white/5 text-xs text-white">
              <SelectValue placeholder="Choisir un client…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={() => setRdvOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gd-orange px-3 py-1.5 text-xs font-bold text-gd-navy-dark hover:brightness-110 transition-all">
            <CalendarPlus className="h-3.5 w-3.5" /> Prendre un RDV
          </button>
          <button onClick={() => navigate('/portefeuille')}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-all">
            <Briefcase className="h-3.5 w-3.5" /> Mon portefeuille
          </button>
          <button onClick={() => navigate('/calendrier')}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors">
            Calendrier <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Grille : Priorités + RDV + Badges */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Priorités du jour */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col">
            <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gd-orange">
              <Star className="h-3.5 w-3.5" /> Mes priorités du jour
            </h2>
            <div className="space-y-2">
              {priorites.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">Portefeuille à jour 🎉</p>
              ) : priorites.map((c) => (
                <button key={c.id} onClick={() => navigate(`/client/${c.id}`)}
                  className="w-full flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-left hover:bg-white/10 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{c.raison_sociale}</p>
                    <p className="text-[10px] text-white/50 flex items-center gap-1">
                      {c.statut === 'À rappeler' ? <><Clock className="h-3 w-3" /> À rappeler</> : c.statut}
                    </p>
                  </div>
                  {c.niveau_appetence && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${niveauBadge(c.niveau_appetence)}`}>{c.niveau_appetence}</span>}
                  <Phone className="h-3.5 w-3.5 text-white/40" />
                </button>
              ))}
            </div>
          </div>

          {/* Prochains RDV */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col">
            <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gd-orange">
              <CalendarPlus className="h-3.5 w-3.5" /> Mes prochains RDV ({upcomingRdvs.length})
            </h2>
            <div className="space-y-2">
              {upcomingRdvs.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">Aucun RDV planifié.</p>
              ) : upcomingRdvs.map((rdv) => {
                const client = clients.find((c) => c.id === rdv.client_id);
                const date = new Date(rdv.date_heure);
                return (
                  <div key={rdv.id} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{client?.raison_sociale || 'Client'}</p>
                      <p className="text-[10px] text-white/50">{date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button disabled={updatingRdv === rdv.id} onClick={() => updateRdvStatus(rdv.id, 'Réalisé')} title="Réalisé"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button disabled={updatingRdv === rdv.id} onClick={() => updateRdvStatus(rdv.id, 'Annulé')} title="Annuler"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mes badges */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col">
            <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gd-orange">
              <Award className="h-3.5 w-3.5" /> Mes badges ({obtenus.length}/{badges.length})
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {badges.map((b) => {
                const earned = obtainedIds.has(b.id);
                return (
                  <div key={b.id} title={b.description || b.nom}
                    className={`relative flex flex-col items-center rounded-lg p-2 border transition-all ${earned ? 'bg-gd-orange/15 border-gd-orange/40' : 'bg-white/5 border-white/10 opacity-50'}`}>
                    <span className="text-2xl mb-0.5">{b.icone || '🏆'}</span>
                    <span className="text-[9px] font-semibold text-white text-center leading-tight">{b.nom}</span>
                    {!earned && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30"><Lock className="h-4 w-4 text-white/60" /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer motivant */}
        <div className="flex items-center justify-center gap-2 text-xs text-white/60">
          <Flame className="h-3.5 w-3.5 text-gd-orange" />
          <span>{stats.rdvRealises + stats.myVentes} action(s) ce mois{monRang.rang ? ` · ${monRang.score} pts au classement` : ''} — continuez ! <Trophy className="inline h-3.5 w-3.5 text-gd-orange" /></span>
        </div>
      </div>

      <RdvExpress open={rdvOpen} onOpenChange={setRdvOpen} client={selectedClient} clients={clients} commercialId={user.id} onSaved={reloadRdvs} />
    </Layout>
  );
}
