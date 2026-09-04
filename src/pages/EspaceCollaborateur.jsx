import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import { Trophy, Target, Calendar, TrendingUp, Award, Flame, Star, Zap, Crown, Medal, Lock } from 'lucide-react';

function ProgressRing({ value, max, label, sublabel, color = '#FFC107' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-white tabular-nums">{value}</span>
          <span className="text-xs text-white/50">/ {max || '—'}</span>
        </div>
      </div>
      <span className="mt-1.5 text-sm font-semibold text-white/90">{label}</span>
      {sublabel && <span className="text-[11px] text-white/40">{sublabel}</span>}
    </div>
  );
}

function CountdownBadge({ targetDate, label }) {
  const [days, setDays] = useState(0);
  useEffect(() => {
    if (!targetDate) return;
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      setDays(Math.max(0, Math.ceil(diff / 86400000)));
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [targetDate]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 border border-white/10 px-8 py-5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-gd-orange">{label}</span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-5xl font-extrabold text-white tabular-nums">{days}</span>
        <span className="text-lg font-bold text-white/60">jours</span>
      </div>
    </div>
  );
}

export default function EspaceCollaborateur() {
  const { user } = useAuth();
  const [params, setParams] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [offres, setOffres] = useState([]);
  const [badges, setBadges] = useState([]);
  const [obtenus, setObtenus] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, r, v, o, b, u] = await Promise.all([
          base44.entities.parametres_operation.list('-created_date', 1),
          base44.entities.rdv.list('-date_heure', 500),
          base44.entities.vente.list('-date_vente', 500),
          base44.entities.offre_magasin.list('-date_debut', 200),
          base44.entities.badge.list('-created_date', 50),
          base44.entities.User.list('-created_date', 200)
        ]);
        setParams(p[0] || null);
        setRdvs(r);
        setVentes(v);
        setOffres(o);
        setBadges(b);
        setUsers(u);
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

  const leaderboard = useMemo(() => {
    const byUser = {};
    rdvs.forEach((r) => {
      if (r.statut === 'Réalisé') {
        byUser[r.commercial_id] = (byUser[r.commercial_id] || 0) + 1;
      }
    });
    ventes.forEach((v) => {
      if (v.statut_validation === 'Validé') {
        byUser[v.commercial_id] = (byUser[v.commercial_id] || 0) + 3;
      }
    });
    return Object.entries(byUser)
      .map(([uid, score]) => ({ user: users.find((u) => u.id === uid), score }))
      .filter((e) => e.user)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [rdvs, ventes, users]);

  const obtainedIds = useMemo(() => new Set(obtenus.map((o) => o.badge_id)), [obtenus]);

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] overflow-hidden rounded-2xl gd-gradient p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Zap className="h-6 w-6 text-gd-orange" /> Mon espace
            </h1>
            <p className="text-sm text-white/50">Opération 50 ans New Holland · Gonnin Duris</p>
          </div>
          <CountdownBadge targetDate={params?.date_debut_operation} label="Avant l'opération" />
        </div>

        {/* Progress rings */}
        <div className="flex items-center justify-around rounded-2xl bg-white/5 border border-white/10 py-5">
          <ProgressRing value={stats.rdvRealises} max={params?.objectif_rdv || 0} label="RDV réalisés" sublabel="ce mois" color="#FFC107" />
          <ProgressRing value={stats.ventesValidees} max={params?.objectif_ventes || 0} label="Ventes validées" sublabel="total" color="#4ADE80" />
          <ProgressRing value={stats.caCumul} max={params?.objectif_ca_magasin || 0} label="CA magasin" sublabel={`${stats.caCumul.toLocaleString('fr-FR')} €`} color="#60A5FA" />
        </div>

        {/* Badges + Leaderboard */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0">
          {/* Badges */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col min-h-0">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-orange">
              <Award className="h-4 w-4" /> Badges ({obtenus.length}/{badges.length})
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto">
              {badges.length === 0 ? (
                <p className="col-span-full text-sm text-white/40 py-4 text-center">Aucun badge configuré.</p>
              ) : badges.map((b) => {
                const earned = obtainedIds.has(b.id);
                return (
                  <div
                    key={b.id}
                    className={`relative flex flex-col items-center rounded-xl p-3 border transition-all ${
                      earned
                        ? 'bg-gd-orange/15 border-gd-orange/40 shadow-lg'
                        : 'bg-white/5 border-white/10 opacity-50'
                    }`}
                  >
                    <span className="text-3xl mb-1">{b.icone || '🏆'}</span>
                    <span className="text-[11px] font-semibold text-white text-center leading-tight">{b.nom}</span>
                    {!earned && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30">
                        <Lock className="h-5 w-5 text-white/60" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col min-h-0">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-orange">
              <Trophy className="h-4 w-4" /> Top 3 — Classement
            </h2>
            <div className="flex-1 flex items-end justify-center gap-4">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-white/40 py-4 text-center self-center">Pas encore de classement.</p>
              ) : leaderboard.map((entry, i) => {
                const heights = ['h-32', 'h-24', 'h-20'];
                const medals = [Crown, Medal, Medal];
                const colors = ['text-gd-orange', 'text-white/70', 'text-orange-700'];
                const Med = medals[i];
                return (
                  <div key={entry.user.id} className="flex flex-col items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark font-bold text-lg">
                        {(entry.user.full_name || entry.user.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="mt-1.5 text-xs font-semibold text-white truncate max-w-[100px]">{entry.user.full_name || entry.user.email}</span>
                      <span className="text-[11px] text-white/50">{entry.score} pts</span>
                    </div>
                    <div className={`w-20 ${heights[i] || 'h-20'} rounded-t-lg bg-gradient-to-t from-gd-orange/20 to-gd-orange/50 border-t-2 border-gd-orange flex items-start justify-center pt-2`}>
                      <Med className={`h-5 w-5 ${colors[i]}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer motivation */}
        <div className="flex items-center justify-center gap-2 text-sm text-white/60">
          <Flame className="h-4 w-4 text-gd-orange" />
          <span>{stats.rdvRealises + stats.ventesValidees} actions réalisées ce mois — continuez sur votre lancée !</span>
        </div>
      </div>
    </Layout>
  );
}