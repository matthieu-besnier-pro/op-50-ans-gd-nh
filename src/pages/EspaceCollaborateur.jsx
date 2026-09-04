import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import RdvDialog from '@/components/RdvDialog';
import VenteDialog from '@/components/VenteDialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Trophy, Award, Flame, Zap, Crown, Medal, Lock, Check, X, CalendarPlus, ShoppingBag, ChevronRight } from 'lucide-react';

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
            style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-white tabular-nums">{value}</span>
          <span className="text-[10px] text-white/50">/ {max || '—'}</span>
        </div>
      </div>
      <span className="mt-1 text-xs font-semibold text-white/90">{label}</span>
      {sublabel && <span className="text-[10px] text-white/40">{sublabel}</span>}
    </div>
  );
}

export default function EspaceCollaborateur() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [offres, setOffres] = useState([]);
  const [badges, setBadges] = useState([]);
  const [obtenus, setObtenus] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [rdvOpen, setRdvOpen] = useState(false);
  const [venteOpen, setVenteOpen] = useState(false);
  const [updatingRdv, setUpdatingRdv] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, r, v, o, b, u, c] = await Promise.all([
          base44.entities.parametres_operation.list('-created_date', 1),
          base44.entities.rdv.list('-date_heure', 500),
          base44.entities.vente.list('-date_vente', 500),
          base44.entities.offre_magasin.list('-date_debut', 200),
          base44.entities.badge.list('-created_date', 50),
          base44.entities.User.list('-created_date', 200),
          base44.entities.client.list('-created_date', 200)
        ]);
        setParams(p[0] || null);
        setRdvs(r);
        setVentes(v);
        setOffres(o);
        setBadges(b);
        setUsers(u);
        setClients(c);
        try {
          const ob = await base44.entities.badge_obtenu.list('-created_date', 200);
          setObtenus(ob);
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const rdvRealises = rdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure >= monthStart).length;
    const ventesValidees = ventes.filter((v) => v.statut_validation === 'Validé').length;
    const caCumul = offres.reduce((s, o) => s + (o.ca_realise || 0), 0);
    return { rdvRealises, ventesValidees, caCumul };
  }, [rdvs, ventes, offres]);

  const upcomingRdvs = useMemo(() => {
    const now = new Date().toISOString();
    return rdvs
      .filter((r) => r.statut === 'Planifié' && r.date_heure >= now)
      .sort((a, b) => a.date_heure.localeCompare(b.date_heure))
      .slice(0, 5);
  }, [rdvs]);

  const leaderboard = useMemo(() => {
    const byUser = {};
    rdvs.forEach((r) => { if (r.statut === 'Réalisé') byUser[r.commercial_id] = (byUser[r.commercial_id] || 0) + 1; });
    ventes.forEach((v) => { if (v.statut_validation === 'Validé') byUser[v.commercial_id] = (byUser[v.commercial_id] || 0) + 3; });
    return Object.entries(byUser)
      .map(([uid, score]) => ({ user: users.find((u) => u.id === uid), score }))
      .filter((e) => e.user)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [rdvs, ventes, users]);

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
    try {
      const r = await base44.entities.rdv.list('-date_heure', 500);
      setRdvs(r);
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div></Layout>;
  }

  const daysLeft = params?.date_debut_operation
    ? Math.max(0, Math.ceil((new Date(params.date_debut_operation).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] overflow-hidden rounded-2xl gd-gradient p-5 flex flex-col gap-4">
        {/* Header + countdown */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-gd-orange" /> Mon espace
            </h1>
            <p className="text-xs text-white/50">50 ans New Holland · Gonnin Duris</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center rounded-xl bg-white/5 border border-white/10 px-5 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gd-orange">Avant l'opération</span>
              <span className="text-2xl font-extrabold text-white tabular-nums">J-{daysLeft}</span>
            </div>
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="h-8 w-64 border-white/10 bg-white/5 text-xs text-white">
              <SelectValue placeholder="Sélectionner un client…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            disabled={!selectedClient}
            onClick={() => setRdvOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gd-orange px-3 py-1.5 text-xs font-bold text-gd-navy-dark disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Nouveau RDV
          </button>
          <button
            disabled={!selectedClient}
            onClick={() => setVenteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Enregistrer vente
          </button>
          <button
            onClick={() => navigate('/calendrier')}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors"
          >
            Voir calendrier <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress rings */}
        <div className="flex items-center justify-around rounded-xl bg-white/5 border border-white/10 py-3">
          <ProgressRing value={stats.rdvRealises} max={params?.objectif_rdv || 0} label="RDV réalisés" sublabel="ce mois" color="#FFC107" />
          <ProgressRing value={stats.ventesValidees} max={params?.objectif_ventes || 0} label="Ventes validées" sublabel="total" color="#4ADE80" />
          <ProgressRing value={stats.caCumul} max={params?.objectif_ca_magasin || 0} label="CA magasin" sublabel={`${stats.caCumul.toLocaleString('fr-FR')} €`} color="#60A5FA" />
        </div>

        {/* Main grid: RDV + Badges/Leaderboard */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
          {/* Prochains RDV with inline actions */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col min-h-0">
            <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gd-orange">
              <CalendarPlus className="h-3.5 w-3.5" /> Prochains RDV ({upcomingRdvs.length})
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {upcomingRdvs.length === 0 ? (
                <p className="text-xs text-white/40 py-4 text-center">Aucun RDV planifié.</p>
              ) : upcomingRdvs.map((rdv) => {
                const client = clients.find((c) => c.id === rdv.client_id);
                const commercial = users.find((u) => u.id === rdv.commercial_id);
                const date = new Date(rdv.date_heure);
                return (
                  <div key={rdv.id} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{client?.raison_sociale || 'Client supprimé'}</p>
                      <p className="text-[10px] text-white/50">
                        {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {commercial && ` · ${commercial.full_name || commercial.email}`}
                      </p>
                    </div>
                    <button
                      disabled={updatingRdv === rdv.id}
                      onClick={() => updateRdvStatus(rdv.id, 'Réalisé')}
                      title="Marquer réalisé"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      disabled={updatingRdv === rdv.id}
                      onClick={() => updateRdvStatus(rdv.id, 'Annulé')}
                      title="Annuler"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges + Leaderboard */}
          <div className="flex flex-col gap-4 min-h-0">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex-1 min-h-0 flex flex-col">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gd-orange">
                <Award className="h-3.5 w-3.5" /> Badges ({obtenus.length}/{badges.length})
              </h2>
              <div className="grid grid-cols-4 gap-2 overflow-y-auto">
                {badges.map((b) => {
                  const earned = obtainedIds.has(b.id);
                  return (
                    <div key={b.id} className={`relative flex flex-col items-center rounded-lg p-2 border transition-all ${earned ? 'bg-gd-orange/15 border-gd-orange/40' : 'bg-white/5 border-white/10 opacity-50'}`}>
                      <span className="text-2xl mb-0.5">{b.icone || '🏆'}</span>
                      <span className="text-[9px] font-semibold text-white text-center leading-tight">{b.nom}</span>
                      {!earned && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30"><Lock className="h-4 w-4 text-white/60" /></div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gd-orange">
                <Trophy className="h-3.5 w-3.5" /> Top 3
              </h2>
              <div className="flex items-center gap-2">
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-white/40">Pas encore de classement.</p>
                ) : leaderboard.map((entry, i) => {
                  const Med = [Crown, Medal, Medal][i];
                  const colors = ['text-gd-orange', 'text-white/70', 'text-orange-700'];
                  return (
                    <div key={entry.user.id} className="flex items-center gap-2 flex-1 rounded-lg bg-white/5 px-2 py-1.5">
                      <Med className={`h-4 w-4 ${colors[i]}`} />
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark font-bold text-xs">
                        {(entry.user.full_name || entry.user.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-white truncate">{entry.user.full_name || entry.user.email}</p>
                        <p className="text-[10px] text-white/50">{entry.score} pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-white/60">
          <Flame className="h-3.5 w-3.5 text-gd-orange" />
          <span>{stats.rdvRealises + stats.ventesValidees} actions réalisées ce mois — continuez !</span>
        </div>
      </div>

      <RdvDialog open={rdvOpen} onOpenChange={setRdvOpen} client={selectedClient} commercialId={user.id} onSaved={reloadRdvs} />
      <VenteDialog open={venteOpen} onOpenChange={setVenteOpen} client={selectedClient} commercialId={user.id} onSaved={reloadRdvs} />
    </Layout>
  );
}