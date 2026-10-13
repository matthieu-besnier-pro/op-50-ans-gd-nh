import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { listerPartage, invalider } from '@/lib/donneesPartagees';
import { fetchOperationStats } from '@/lib/operationStats';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import OpLogo from '@/components/OpLogo';
import {
  Zap, Trophy, Wrench, Flame, Award, Clock, Target,
  Users, Star, CalendarCheck, TrendingUp, Sparkles, X, Satellite
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

/* ---------- Podium ---------- */
// Les trois premiers sortent de la liste : sur un écran projeté, un podium se
// lit d'un coup d'œil là où une suite de lignes se ressemble toutes.
// Ordre d'affichage : 2e à gauche, 1er au centre sur la marche haute, 3e à droite.
const MARCHES = [
  { rang: 2, medaille: '🥈', hauteur: 'h-16', socle: 'from-slate-200/30 to-slate-400/5', bord: 'border-slate-200/40' },
  { rang: 1, medaille: '🥇', hauteur: 'h-24', socle: 'from-gd-orange/45 to-yellow-300/5', bord: 'border-gd-orange/60' },
  { rang: 3, medaille: '🥉', hauteur: 'h-11', socle: 'from-amber-600/30 to-amber-800/5', bord: 'border-amber-500/40' }
];

function Podium({ entrees, unite }) {
  return (
    <div className="flex items-end justify-center gap-3 shrink-0 mb-5">
      {MARCHES.map((m) => {
        const e = entrees[m.rang - 1];
        // Moins de trois commerciaux classés : la marche reste vide plutôt que
        // de décaler le podium.
        if (!e) return <div key={m.rang} className="flex-1" />;
        return (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="flex-1 min-w-0 flex flex-col items-center"
          >
            <div className={m.rang === 1 ? 'text-4xl leading-none' : 'text-3xl leading-none'}>{m.medaille}</div>
            <p className={`mt-1.5 w-full truncate text-center font-bold text-white ${m.rang === 1 ? 'text-lg' : 'text-base'}`}>
              {e.name}
            </p>
            <div className="flex items-baseline gap-1.5">
              <AnimatedCounter value={e.count} className={`font-extrabold tabular-nums ${m.rang === 1 ? 'text-5xl text-gd-orange' : 'text-3xl text-white'}`} />
              <span className="text-[11px] uppercase tracking-widest text-white/40">{unite}</span>
            </div>
            <div className={`mt-2 w-full rounded-t-2xl border border-b-0 bg-gradient-to-b ${m.socle} ${m.bord} ${m.hauteur} flex items-start justify-center pt-1.5`}>
              <span className="text-3xl font-black text-white/25">{m.rang}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------- Leaderboard row ---------- */
// Densité des places 4 et suivantes. L'argument est le nombre de LIGNES de la
// grille, pas le nombre de commerciaux : deux colonnes en logent deux par ligne.
function densiteClassement(n) {
  if (n <= 5) return { pad: 'px-4 py-3', gap: 'gap-3', rang: 'text-lg', nom: 'text-lg', barre: 'mt-2 h-2', compteur: 'text-3xl', libelle: 'text-xs', grille: 'gap-3' };
  if (n <= 9) return { pad: 'px-3 py-2', gap: 'gap-2.5', rang: 'text-base', nom: 'text-base', barre: 'mt-1.5 h-1.5', compteur: 'text-2xl', libelle: 'text-[10px]', grille: 'gap-2' };
  return { pad: 'px-2.5 py-1.5', gap: 'gap-2', rang: 'text-sm', nom: 'text-sm', barre: 'mt-1 h-1', compteur: 'text-xl', libelle: 'text-[9px]', grille: 'gap-1.5' };
}

function LeaderRow({ rank, name, count, total, isAtelier, prevRank, d, unite }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const movedUp = prevRank !== null && prevRank > rank;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`relative flex items-center rounded-2xl bg-white/5 border border-white/5 ${d.gap} ${d.pad}`}
    >
      <div className={`${d.rang} shrink-0 font-extrabold tabular-nums text-white/40 w-6 text-center`}>{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`${d.nom} font-bold text-white truncate`}>{name}</span>
          {isAtelier && <Wrench className="h-4 w-4 text-gd-orange shrink-0" />}
          {movedUp && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center text-gd-orange">
              <Flame className="h-4 w-4" />
            </motion.span>
          )}
        </div>
        <div className={`${d.barre} w-full rounded-full bg-white/10 overflow-hidden`}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gd-orange to-yellow-300"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <AnimatedCounter value={count} className={`${d.compteur} font-extrabold text-white tabular-nums`} />
        <p className={`${d.libelle} text-white/40`}>{unite}</p>
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
  const [structure, setStructure] = useState([]);
  const [clients, setClients] = useState({});
  const [badgeObtenus, setBadgeObtenus] = useState([]);
  const [badges, setBadges] = useState([]);
  const [now, setNow] = useState(new Date());
  const [prevRanks, setPrevRanks] = useState({});
  const [recentEvent, setRecentEvent] = useState(null);

  // Demo mode: ?demo=sprint | ?demo=ventes
  const demoMode = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get('demo');
    if (p === 'sprint') return { key: 'sprint', phase: 'sprint', date: new Date('2026-10-14T14:00:00') };
    if (p === 'ventes') return { key: 'ventes', phase: 'ventes', date: new Date('2026-10-16T10:00:00') };
    return null;
  }, []);

  const [exacts, setExacts] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, r, v, u, bo, st, bdg, statsRes] = await Promise.all([
        listerPartage('parametres_operation', '-created_date', 1),
        listerPartage('rdv', '-date_heure', 500),
        listerPartage('vente', '-date_vente', 500),
        listerPartage('User', '-created_date', 300).catch(() => []),
        listerPartage('badge_obtenu', '-created_date', 100),
        listerPartage('structure_commerciale', '-nom_commercial', 200),
        listerPartage('badge', '-created_date', 50).catch(() => []),
        fetchOperationStats()
      ]);
      setExacts(statsRes || null);
      setParams(p[0] || null);
      setRdvs(r);
      setVentes(v);
      setUsers(u);
      setStructure(st);
      setBadgeObtenus(bo);
      setBadges(bdg);
      // Noms des clients du feed, lus côté serveur : les droits du navigateur
      // varient selon le compte qui projette, et l'écran doit toujours afficher
      // « RDV chez X ». Charge minimale : identifiant et raison sociale.
      const clientIds = [...new Set(r.map(rd => rd.client_id).filter(Boolean))].slice(0, 100);
      if (clientIds.length > 0) {
        const res = await base44.functions
          .invoke('lister_clients', { noms_client_ids: clientIds })
          .catch(() => null);
        const map = {};
        (res?.data?.noms || []).forEach((c) => { map[c.id] = c; });
        setClients(map);
      }
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

  // Name resolver: le commercial_id est un user_id. On résout via structure_commerciale.user_id
  // (car list sur l'entité User est refusée par Base44), avec repli sur users si dispo.
  const nameMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u.full_name || u.email; });
    structure.forEach(s => {
      m[s.id] = s.nom_commercial;
      if (s.user_id) m[s.user_id] = s.nom_commercial;
    });
    return m;
  }, [users, structure]);

  // Catalogue des badges : id → { nom, icone }
  const badgeMap = useMemo(() => {
    const m = {};
    badges.forEach(b => { m[b.id] = b; });
    return m;
  }, [badges]);

  // Seuls les badges encore au catalogue sont affichés : les attributions d'anciens
  // badges supprimés (reliquats) ne doivent plus apparaître sur le mur.
  // Mur validé par le serveur : seuls les badges ENCORE mérités y figurent.
  // L'écran se corrige donc tout seul si un RDV est annulé ou des données purgées,
  // sans attendre qu'on lance un recalcul depuis l'administration.
  const badgesAffiches = useMemo(
    () => (exacts?.badges?.mur
      ? exacts.badges.mur.filter((bo) => badgeMap[bo.badge_id])
      : badgeObtenus.filter((bo) => badgeMap[bo.badge_id])),
    [exacts, badgeObtenus, badgeMap]
  );

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

  // Sprint RDV stats
  const sprintRdvs = useMemo(() => {
    if (!params?.date_debut_prise_rdv) return [];
    return rdvs.filter(r => {
      // Un rendez-vous annulé est soustrait : ni du compteur, ni du classement.
      if (r.statut === 'Annulé') return false;
      // Le sprint récompense la PRISE de rendez-vous : on retient la date à
      // laquelle il a été posé, pas celle à laquelle il aura lieu. Un RDV pris
      // le 13 pour le 25 compte bien pour le sprint.
      const d = (r.created_date || r.date_heure || '').slice(0, 10);
      return d >= params.date_debut_prise_rdv && d <= params.date_fin_prise_rdv;
    });
  }, [rdvs, params]);

  // Comptages exacts côté serveur ; repli sur la liste chargée en attendant.
  const sprintRdvCount = exacts?.rdv?.sprint?.total ?? sprintRdvs.length;
  const objRdv = params?.objectif_rdv || 100;
  const sprintAtelierCount = exacts?.rdv?.sprint?.atelier ?? sprintRdvs.filter(r => r.type === 'RDV atelier hivernage').length;
  const sprintCommercialCount = exacts?.rdv?.sprint?.commercial ?? sprintRdvs.filter(r => r.type === 'RDV commercial').length;
  const sprintAgriCount = exacts?.rdv?.sprint?.agri ?? sprintRdvs.filter(r => r.type === 'RDV agri. précision').length;

  // Leaderboard
  // Classement : on prend les comptages du serveur, qui parcourt TOUS les
  // rendez-vous. La liste chargée ici est plafonnée et triée par date : s'en
  // servir faisait disparaître du classement les commerciaux dont les
  // rendez-vous tombaient hors de la tranche chargée.
  const leaderboard = useMemo(() => {
    const exact = exacts?.rdv?.sprint_par_commercial;
    const counts = {};
    if (exact && Object.keys(exact).length > 0) {
      Object.entries(exact).forEach(([id, n]) => { counts[id] = n; });
    } else {
      sprintRdvs.forEach(r => {
        if (!r.commercial_id) return;
        counts[r.commercial_id] = (counts[r.commercial_id] || 0) + 1;
      });
    }
    const entries = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({
        id, count, name: nameMap[id] || `Commercial ${id.slice(-4)}`,
        // Indication visuelle seulement : déduite des rendez-vous chargés.
        isAtelier: sprintRdvs.some(r => r.commercial_id === id && r.type === 'RDV atelier hivernage')
      }));
    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [exacts, sprintRdvs, nameMap]);

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
    // Un rendez-vous annulé ne doit pas défiler comme une victoire.
    return rdvs
      .filter((r) => r.statut !== 'Annulé')
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
      id, count, name: nameMap[id] || `Commercial ${id.slice(-4)}`
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [ventesValidees, nameMap]);

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
          <OpLogo
            className="h-14 w-14 rounded-full object-contain"
            fallback={(
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-orange text-gd-navy-dark">
                <Zap className="h-7 w-7" fill="currentColor" />
              </div>
            )}
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">CockpitOP</h1>
            <p className="text-xs font-medium uppercase tracking-widest text-gd-orange">50 ans Gonnin Duris × New Holland</p>
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
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums leading-none">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link
            to="/tableau-de-bord"
            title="Quitter le Grand Écran"
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" /> Quitter
          </Link>
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
                  <div className="mt-6 grid grid-cols-3 gap-3 w-full">
                    <div className="rounded-2xl bg-gd-navy/40 p-3 text-center">
                      <CalendarCheck className="h-5 w-5 mx-auto text-white/60 mb-1" />
                      <p className="text-2xl font-extrabold text-white"><AnimatedCounter value={sprintCommercialCount} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">Matériel</p>
                    </div>
                    <div className="rounded-2xl bg-gd-orange/15 p-3 text-center">
                      <Wrench className="h-5 w-5 mx-auto text-gd-orange mb-1" />
                      <p className="text-2xl font-extrabold text-gd-orange"><AnimatedCounter value={sprintAtelierCount} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">Atelier</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/15 p-3 text-center">
                      <Satellite className="h-5 w-5 mx-auto text-emerald-400 mb-1" />
                      <p className="text-2xl font-extrabold text-emerald-400"><AnimatedCounter value={sprintAgriCount} /></p>
                      <p className="text-xs text-white/40 uppercase tracking-wide">Agri. précision</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ProgressRing value={exacts?.ventes?.validees ?? ventesValidees.length} max={params?.objectif_ventes || 50} label="Ventes validées" sublabel="objectif" />
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
              {/* Deux colonnes : deux fois plus de badges visibles. */}
              <div className="grid grid-cols-2 gap-2">
                {badgesAffiches.length === 0 ? (
                  <p className="col-span-2 text-sm text-white/40 py-4 text-center">Aucun badge encore — que le sprint commence !</p>
                ) : (
                  badgesAffiches.slice(0, 12).map((bo, i) => {
                    const b = badgeMap[bo.badge_id];
                    return (
                      <motion.div key={bo.id || i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-2 rounded-xl bg-gd-orange/10 border border-gd-orange/20 px-2.5 py-2">
                        <span className="text-xl shrink-0">{b?.icone || '🏆'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{b?.nom || 'Badge'}</p>
                          <p className="text-[11px] text-white/60 truncate">{nameMap[bo.utilisateur_id] || 'Commercial'}</p>
                        </div>
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
              {/* Podium pour les trois premiers, puis les suivants sur deux
                  colonnes : plus lisible de loin qu'une longue liste, et tout
                  le monde tient à l'écran. */}
              {(() => {
                const liste = phase === 'sprint' ? leaderboard : ventesLeaderboard;
                const unite = phase === 'sprint' ? 'RDV' : 'ventes';
                if (liste.length === 0) {
                  return (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                      <Flame className="h-12 w-12 text-gd-orange/50 mb-3" />
                      <p className="text-lg font-semibold text-white/60">En attente du premier RDV…</p>
                      <p className="text-sm text-white/40 mt-1">Que la meilleure équipe gagne !</p>
                    </div>
                  );
                }
                const reste = liste.slice(3);
                // La densité se règle sur le nombre de lignes de la grille, pas
                // sur le nombre de commerciaux : deux colonnes en logent deux.
                const d = densiteClassement(Math.ceil(reste.length / 2));
                return (
                  // Tant qu'il n'y a que trois commerciaux classés, le podium
                  // se cale au centre plutôt que de flotter en haut du cadre.
                  <div className={`flex flex-1 flex-col min-h-0 ${reste.length === 0 ? 'justify-center' : ''}`}>
                    <Podium entrees={liste.slice(0, 3)} unite={unite} />
                    {reste.length > 0 && (
                      <div className={`grid grid-cols-2 content-start ${d.grille} flex-1 overflow-y-auto pr-1`}>
                        <AnimatePresence>
                          {reste.map((entry, i) => (
                            <LeaderRow
                              key={entry.id}
                              rank={i + 4}
                              name={entry.name}
                              count={entry.count}
                              total={liste[0]?.count || 1}
                              isAtelier={entry.isAtelier}
                              prevRank={prevRanks[entry.id] || null}
                              d={d}
                              unite={unite}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                        userName={nameMap[rdv.commercial_id]}
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
            { key: 'sprint', label: 'Sprint RDV' },
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
            Arrêter la démo
          </a>
        </div>
      )}
    </div>
  );
}