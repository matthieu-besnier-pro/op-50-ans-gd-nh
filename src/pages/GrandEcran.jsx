import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Zap, Trophy, Wrench, Flame, Award, Clock, Target,
  Users, Star, CalendarCheck, TrendingUp, Sparkles
} from 'lucide-react';

/* ---------- Animated counter ---------- */
function AnimatedCounter({ value, duration = 1000, className = '' }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress >= 1) { clearInterval(timer); prevRef.current = end; }
    }, 30);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span className={className}>{display}</span>;
}

/* ---------- Progress ring ---------- */
function ProgressRing({ value, max, size = 220, stroke = 18, color = 'hsl(45 100% 51%)', label, sublabel }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;
  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedCounter value={value} className="text-6xl font-extrabold text-white tabular-nums" />
          {sublabel && <span className="text-sm font-medium text-white/50 mt-0.5">/ {max} {sublabel}</span>}
        </div>
      </div>
      {label && <span className="mt-3 text-sm font-bold uppercase tracking-widest text-white/70">{label}</span>}
    </div>
  );
}

/* ---------- Leaderboard row ---------- */
function LeaderRow({ rank, name, count, total, isAtelier, prevRank }) {
  const medals = ['🥇', '🥈', '🥉'];
  const pct = total > 0 ? (count / total) * 100 : 0;
  const movedUp = prevRank !== null && prevRank > rank;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`relative flex items-center gap-4 rounded-2xl px-5 py-4 ${rank <= 3 ? 'bg-white/10 border border-gd-orange/30' : 'bg-white/5 border border-white/5'}`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center text-2xl font-extrabold text-white">
        {rank <= 3 ? medals[rank - 1] : <span className="text-lg text-white/50">{rank}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white truncate">{name}</span>
          {isAtelier && <Wrench className="h-4 w-4 text-gd-orange shrink-0" />}
          {movedUp && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center text-gd-orange">
              <Flame className="h-4 w-4" />
            </motion.span>
          )}
        </div>
        <div className="mt-2 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gd-orange to-yellow-300"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <AnimatedCounter value={count} className="text-3xl font-extrabold text-white tabular-nums" />
        <p className="text-xs text-white/40">RDV</p>
      </div>
    </motion.div>
  );
}

/* ---------- Live feed item ---------- */
function FeedItem({ rdv, clientName, userName, isNew }) {
  const isAtelier = rdv.type === 'RDV atelier hivernage';
  return (
    <motion.div
      initial={{ opacity: 0, y: -15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${isNew ? 'bg-gd-orange/20 border border-gd-orange/40' : 'bg-white/5 border border-white/5'}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isAtelier ? 'bg-gd-orange/20 text-gd-orange' : 'bg-gd-navy/40 text-white'}`}>
        {isAtelier ? <Wrench className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{clientName || 'Client'}</p>
        <p className="text-xs text-white/50 truncate">{userName || 'Commercial'} · {rdv.type}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-white/40">{rdv.date_heure ? new Date(rdv.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</p>
        <p className="text-xs text-white/40">{rdv.date_heure ? new Date(rdv.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
      </div>
    </motion.div>
  );
}

/* ---------- Main component ---------- */
export default function GrandEcran() {
  const [params, setParams] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState({});
  const [badgeObtenus, setBadgeObtenus] = useState([]);
  const [now, setNow] = useState(new Date());
  const [prevRanks, setPrevRanks] = useState({});
  const [recentEvent, setRecentEvent] = useState(null);

  // Demo mode: ?demo=jour1 | ?demo=jour2 | ?demo=ventes
  const demoMode = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get('demo');
    if (p === 'jour1') return { key: 'jour1', phase: 'sprint', date: new Date('2026-10-13T09:30:00') };
    if (p === 'jour2') return { key: 'jour2', phase: 'sprint', date: new Date('2026-10-14T14:00:00') };
    if (p === 'ventes') return { key: 'ventes', phase: 'ventes', date: new Date('2026-10-16T10:00:00') };
    return null;
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, r, v, u, bo] = await Promise.all([
        base44.entities.parametres_operation.list('-created_date', 1),
        base44.entities.rdv.list('-date_heure', 500),
        base44.entities.vente.list('-date_vente', 500),
        base44.entities.User.list('-created_date', 50),
        base44.entities.badge_obtenu.list('-created_date', 100)
      ]);
      setParams(p[0] || null);
      setRdvs(r);
      setVentes(v);
      setUsers(u);
      setBadgeObtenus(bo);
      const clientIds = [...new Set(r.map(rd => rd.client_id))].slice(0, 100);
      const clientResults = await Promise.all(clientIds.map(id => base44.entities.client.get(id).catch(() => null)));
      const map = {};
      clientResults.filter(Boolean).forEach(c => { map[c.id] = c; });
      setClients(map);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = base44.entities.rdv.subscribe((event) => {
      if (event.type === 'create') {
        setRecentEvent({ data: event.data, time: Date.now() });
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#FFC107', '#00356B', '#ffffff', '#FFD54F'] });
        setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#FFC107', '#ffffff'] }), 200);
        setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#FFC107', '#ffffff'] }), 400);
      }
      load();
    });
    return unsubscribe;
  }, [load]);

  // Clock (demo mode ticks from simulated date)
  useEffect(() => {
    if (demoMode) {
      const startReal = Date.now();
      const startSim = demoMode.date.getTime();
      setNow(new Date(startSim));
      const timer = setInterval(() => {
        setNow(new Date(startSim + (Date.now() - startReal)));
      }, 1000);
      return () => clearInterval(timer);
    }
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [demoMode]);

  // Clear recent event after 5s
  useEffect(() => {
    if (recentEvent) {
      const t = setTimeout(() => setRecentEvent(null), 5000);
      return () => clearTimeout(t);
    }
  }, [recentEvent]);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  // Phase detection
  const phase = useMemo(() => {
    if (demoMode) return demoMode.phase;
    if (!params?.date_debut_prise_rdv) return 'sprint';
    const fin = new Date(params.date_fin_prise_rdv + 'T23:59:59');
    const ventesStart = new Date(fin); ventesStart.setDate(ventesStart.getDate() + 1);
    if (now <= fin) return 'sprint';
    if (now < ventesStart) return 'transition';
    return 'ventes';
  }, [params, now, demoMode]);

  // Sprint day indicator
  const sprintDay = useMemo(() => {
    if (!params?.date_debut_prise_rdv || phase !== 'sprint') return null;
    const d1 = new Date(params.date_debut_prise_rdv + 'T00:00:00');
    const d2 = new Date(params.date_fin_prise_rdv + 'T00:00:00');
    const todayStr = now.toISOString().slice(0, 10);
    if (todayStr === params.date_debut_prise_rdv) return { num: 1, isAtelierDay: params.date_debut_prise_rdv === params.date_fin_prise_rdv };
    if (todayStr === params.date_fin_prise_rdv) return { num: 2, isAtelierDay: true };
    return { num: 1, isAtelierDay: false };
  }, [params, now, phase]);

  // Sprint RDV stats
  const sprintRdvs = useMemo(() => {
    if (!params?.date_debut_prise_rdv) return [];
    return rdvs.filter(r => {
      const d = (r.date_heure || '').slice(0, 10);
      return d >= params.date_debut_prise_rdv && d <= params.date_fin_prise_rdv;
    });
  }, [rdvs, params]);

  const sprintRdvCount = sprintRdvs.length;
  const objRdv = params?.objectif_rdv || 100;
  const sprintAtelierCount = sprintRdvs.filter(r => r.type === 'RDV atelier hivernage').length;
  const sprintCommercialCount = sprintRdvs.filter(r => r.type === 'RDV commercial').length;

  // Leaderboard
  const leaderboard = useMemo(() => {
    const counts = {};
    sprintRdvs.forEach(r => {
      if (!r.commercial_id) return;
      counts[r.commercial_id] = (counts[r.commercial_id] || 0) + 1;
    });
    const entries = Object.entries(counts).map(([id, count]) => ({
      id, count, name: userMap[id]?.full_name || userMap[id]?.email || `Commercial ${id.slice(-4)}`,
      isAtelier: sprintRdvs.some(r => r.commercial_id === id && r.type === 'RDV atelier hivernage')
    }));
    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [sprintRdvs, userMap]);

  // Track rank changes
  useEffect(() => {
    const newRanks = {};
    leaderboard.forEach((e, i) => { newRanks[e.id] = i + 1; });
    setPrevRanks(prev => {
      const updated = { ...prev };
      Object.keys(newRanks).forEach(id => {
        if (prev[id] !== undefined) updated[id] = prev[id];
      });
      return updated;
    });
    const t = setTimeout(() => setPrevRanks(newRanks), 3000);
    return () => clearTimeout(t);
  }, [leaderboard]);

  // Live feed (most recent RDVs)
  const liveFeed = useMemo(() => {
    return [...rdvs]
      .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))
      .slice(0, 8);
  }, [rdvs]);

  // Ventes stats (phase ventes)
  const ventesValidees = ventes.filter(v => v.statut_validation === 'Validé');
  const ventesLeaderboard = useMemo(() => {
    const counts = {};
    ventesValidees.forEach(v => {
      if (!v.commercial_id) return;
      counts[v.commercial_id] = (counts[v.commercial_id] || 0) + 1;
    });
    return Object.entries(counts).map(([id, count]) => ({
      id, count, name: userMap[id]?.full_name || userMap[id]?.email || `Commercial ${id.slice(-4)}`
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [ventesValidees, userMap]);

  const phaseLabel = {
    sprint: { text: 'SPRINT RDV EN COURS', color: 'text-gd-orange', icon: Zap },
    transition: { text: 'Transition vers les ventes', color: 'text-white/70', icon: TrendingUp },
    ventes: { text: 'SPRINT VENTES', color: 'text-gd-orange', icon: TrendingUp }
  }[phase];

  const PhaseIcon = phaseLabel?.icon || Clock;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gd-navy-dark via-gd-navy to-gd-navy-dark text-white overflow-hidden">
      {/* Decorative glow */}
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-gd-orange/20 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-orange text-gd-navy-dark">
            <Zap className="h-7 w-7" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">NH50 Pro Tracker</h1>
            <p className="text-xs font-medium uppercase tracking-widest text-gd-orange">50 ans New Holland</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${phase === 'sprint' ? 'bg-gd-orange/20 border border-gd-orange/40 animate-pulse' : 'bg-white/5 border border-white/10'}`}>
            <PhaseIcon className={`h-5 w-5 ${phaseLabel.color}`} />
            <span className={`text-sm font-bold uppercase tracking-wider ${phaseLabel.color}`}>{phaseLabel.text}</span>
          </div>
          {demoMode && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-400/40">
              <span className="text-sm font-bold uppercase tracking-wider text-purple-300">Démo</span>
            </div>
          )}
          {sprintDay && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <span className="text-sm font-bold uppercase tracking-wider text-white">Jour {sprintDay.num}</span>
              {sprintDay.isAtelierDay && (
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gd-orange">
                  <Wrench className="h-3.5 w-3.5" /> Atelier
                </span>
              )}
            </div>
          )}
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums leading-none">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </header>

      {/* Sprint / Ventes phase */}
      <div className="relative z-10 grid grid-cols-12 gap-6 px-8 py-6" style={{ minHeight: 'calc(100vh - 88px)' }}>
          {/* Left column - Rings & stats */}
          <div className="col-span-3 flex flex-col gap-6">
            <div className="flex flex-col items-center rounded-3xl bg-white/5 border border-white/10 p-6">
              {phase === 'sprint' ? (
                <>
                  <ProgressRing value={sprintRdvCount} max={objRdv} label="RDV Sprint" sublabel={`objectif`} />
                  <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                    <div className="rounded-2xl bg-gd-navy/40 p-3 text-center">
                      <CalendarCheck className="h-5 w-5 mx-auto text-white/60 mb-1" />
                      <p className="text-2xl font-extrabold text-white"><AnimatedCounter value={sprintCommercialCount} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">Commercial</p>
                    </div>
                    <div className="rounded-2xl bg-gd-orange/15 p-3 text-center">
                      <Wrench className="h-5 w-5 mx-auto text-gd-orange mb-1" />
                      <p className="text-2xl font-extrabold text-gd-orange"><AnimatedCounter value={sprintAtelierCount} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">Atelier</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ProgressRing value={ventesValidees.length} max={params?.objectif_ventes || 50} label="Ventes validées" sublabel="objectif" />
                  <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                    <div className="rounded-2xl bg-gd-navy/40 p-3 text-center">
                      <Trophy className="h-5 w-5 mx-auto text-white/60 mb-1" />
                      <p className="text-2xl font-extrabold text-white"><AnimatedCounter value={ventesValidees.length} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">Validées</p>
                    </div>
                    <div className="rounded-2xl bg-gd-orange/15 p-3 text-center">
                      <Target className="h-5 w-5 mx-auto text-gd-orange mb-1" />
                      <p className="text-2xl font-extrabold text-gd-orange"><AnimatedCounter value={ventes.filter(v => v.statut_validation === 'À valider').length} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">À valider</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Badges unlocked */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-5 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/70 mb-3">
                <Award className="h-4 w-4 text-gd-orange" /> Badges débloqués
              </h3>
              <div className="space-y-2">
                {badgeObtenus.length === 0 ? (
                  <p className="text-sm text-white/40 py-4 text-center">Aucun badge encore — que le sprint commence !</p>
                ) : (
                  badgeObtenus.slice(0, 5).map((bo, i) => {
                    const u = userMap[bo.utilisateur_id];
                    return (
                      <motion.div key={bo.id || i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-3 rounded-xl bg-gd-orange/10 border border-gd-orange/20 px-3 py-2">
                        <Star className="h-5 w-5 text-gd-orange" fill="currentColor" />
                        <span className="text-sm font-semibold text-white truncate">{u?.full_name || 'Commercial'}</span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Center column - Leaderboard */}
          <div className="col-span-6 flex flex-col">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h2 className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-wider text-white">
                  <Trophy className="h-6 w-6 text-gd-orange" /> Classement Live
                </h2>
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gd-orange">
                  <span className="h-2 w-2 rounded-full bg-gd-orange animate-pulse" /> Temps réel
                </span>
              </div>
              <div className="space-y-3 flex-1">
                <AnimatePresence>
                  {(phase === 'sprint' ? leaderboard : ventesLeaderboard).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Flame className="h-12 w-12 text-gd-orange/50 mb-3" />
                      <p className="text-lg font-semibold text-white/60">En attente du premier RDV…</p>
                      <p className="text-sm text-white/40 mt-1">Que la meilleure équipe gagne !</p>
                    </div>
                  ) : (
                    (phase === 'sprint' ? leaderboard : ventesLeaderboard).map((entry, i) => (
                      <LeaderRow
                        key={entry.id}
                        rank={i + 1}
                        name={entry.name}
                        count={entry.count}
                        total={(phase === 'sprint' ? leaderboard : ventesLeaderboard)[0]?.count || 1}
                        isAtelier={entry.isAtelier}
                        prevRank={prevRanks[entry.id] || null}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right column - Live feed */}
          <div className="col-span-3 flex flex-col">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-5 flex-1 flex flex-col">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/70 mb-4">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Feed en direct
              </h3>
              <div className="space-y-2.5 overflow-hidden flex-1">
                <AnimatePresence initial={false}>
                  {liveFeed.length === 0 ? (
                    <p className="text-sm text-white/40 py-8 text-center">Pas encore de RDV enregistré.</p>
                  ) : (
                    liveFeed.map((rdv) => (
                      <FeedItem
                        key={rdv.id}
                        rdv={rdv}
                        clientName={clients[rdv.client_id]?.raison_sociale}
                        userName={userMap[rdv.commercial_id]?.full_name}
                        isNew={recentEvent?.data?.id === rdv.id}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

      {/* New RDV celebration banner */}
      <AnimatePresence>
        {recentEvent && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-gd-orange px-8 py-4 shadow-2xl"
          >
            <Sparkles className="h-6 w-6 text-gd-navy-dark" />
            <span className="text-lg font-extrabold text-gd-navy-dark uppercase tracking-wide">
              Nouveau RDV ! {clients[recentEvent.data?.client_id]?.raison_sociale || ''}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo switcher */}
      {demoMode && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-1.5">
          <span className="text-xs text-white/50 px-2 font-medium">Démo :</span>
          {[
            { key: 'jour1', label: 'Jour 1' },
            { key: 'jour2', label: 'Jour 2' },
            { key: 'ventes', label: 'Ventes' }
          ].map(m => (
            <a key={m.key} href={`/grand-ecran?demo=${m.key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                demoMode.key === m.key ? 'bg-gd-orange text-gd-navy-dark' : 'text-white/60 hover:bg-white/10'
              }`}>
              {m.label}
            </a>
          ))}
          <a href="/grand-ecran" className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:bg-white/10 transition-colors">
            Quitter
          </a>
        </div>
      )}
    </div>
  );
}