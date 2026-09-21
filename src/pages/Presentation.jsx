import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ArrowRight, ArrowLeft, Flame, Sparkles, Compass, Target,
  Calendar, ShoppingBag, Wrench, Lightbulb, Trophy, TrendingUp,
  Users, Tractor, Zap, CheckCircle2, BarChart3, Award, Play
} from 'lucide-react';

const SLIDES = [
  { id: 'hero' },
  { id: 'contexte' },
  { id: 'collaborateur' },
  { id: 'coach' },
  { id: 'grandecran' },
  { id: 'admin' },
  { id: 'resultats' },
  { id: 'roadmap' }
];

export default function Presentation() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [stats, setStats] = useState({ clients: 0, rdv: 0, ventes: 0, badges: 0, users: 0 });

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const [clients, rdvs, ventes, badges, users] = await Promise.all([
          base44.entities.client.list('-created_date', 200),
          base44.entities.rdv.list('-created_date', 200),
          base44.entities.vente.list('-created_date', 200),
          base44.entities.badge_obtenu.list('-created_date', 200),
          base44.entities.User.list('-created_date', 200).catch(() => [])
        ]);
        setStats({
          clients: clients.length,
          rdv: rdvs.length,
          ventes: ventes.length,
          badges: badges.length,
          users: users.length
        });
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const slide = SLIDES[current];

  return (
    <div className="fixed inset-0 bg-gd-navy-dark overflow-hidden select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {slide.id === 'hero' && <HeroSlide stats={stats} />}
          {slide.id === 'contexte' && <ContexteSlide />}
          {slide.id === 'collaborateur' && <CollaborateurSlide />}
          {slide.id === 'coach' && <CoachSlide />}
          {slide.id === 'grandecran' && <GrandEcranSlide />}
          {slide.id === 'admin' && <AdminSlide />}
          {slide.id === 'resultats' && <ResultatsSlide stats={stats} />}
          {slide.id === 'roadmap' && <RoadmapSlide />}
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
        <button onClick={prev} disabled={current === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-all">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${i === current ? 'w-8 bg-gd-orange' : 'w-2 bg-white/30'}`} />
          ))}
        </div>
        <button onClick={next} disabled={current === SLIDES.length - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark hover:bg-gd-orange/80 disabled:opacity-30 transition-all">
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <button onClick={() => navigate('/')} className="absolute top-4 right-4 text-white/40 hover:text-white text-xs flex items-center gap-1 z-50">
        <Play className="h-3 w-3" /> Échap pour quitter
      </button>
    </div>
  );
}

function HeroSlide({ stats }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 relative">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
        className="mb-6">
        <div className="inline-flex items-center justify-center h-24 w-24 rounded-3xl bg-gd-orange mb-6">
          <Tractor className="h-12 w-12 text-gd-navy-dark" />
        </div>
      </motion.div>
      <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
        className="text-gd-orange font-semibold tracking-widest uppercase text-sm mb-3">Opération spéciale · 13–14 octobre</motion.p>
      <motion.h1 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
        className="text-6xl md:text-7xl font-extrabold text-white mb-4 leading-tight">
        Cockpit<span className="text-gd-orange">OP</span>
      </motion.h1>
      <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
        className="text-xl text-white/70 max-w-2xl mb-12">
        La plateforme de pilotage commercial gamifiée pour fêter les 50 ans de New Holland
      </motion.p>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }}
        className="flex gap-8">
        <AnimatedStat value={stats.clients} label="Clients" />
        <AnimatedStat value={stats.rdv} label="RDV" />
        <AnimatedStat value={stats.ventes} label="Ventes" />
        <AnimatedStat value={stats.users} label="Commerciaux" />
      </motion.div>
    </div>
  );
}

function AnimatedStat({ value, label }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplay(Math.round(value * progress));
      if (progress >= 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <div className="text-center">
      <p className="text-5xl font-extrabold text-gd-orange tabular-nums">{display}</p>
      <p className="text-sm text-white/60 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function ContexteSlide() {
  const challenges = [
    { icon: Users, title: "Portefeuilles dispersés", desc: "Données SIV, MISTRA et PAC éclatées sur plusieurs fichiers" },
    { icon: Calendar, title: "Objectif RDV ambitieux", desc: "Mobiliser tous les commerciaux sur un sprint de 6 semaines" },
    { icon: BarChart3, title: "Pilotage en temps réel", desc: "La direction a besoin d'une visibilité instantanée" },
    { icon: Trophy, title: "Motivation des équipes", desc: "Générer de l'émulation et de la compétition saine" }
  ];
  return (
    <div className="h-full flex flex-col justify-center px-16 max-w-6xl mx-auto">
      <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="text-5xl font-extrabold text-white mb-3">Le défi</motion.h2>
      <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-xl text-white/60 mb-12">Centraliser, motiver, piloter — sur une seule plateforme</motion.p>
      <div className="grid grid-cols-2 gap-6">
        {challenges.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-start gap-4 rounded-2xl bg-white/5 border border-white/10 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-orange/20 shrink-0">
                <Icon className="h-6 w-6 text-gd-orange" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{c.title}</h3>
                <p className="text-white/60 text-sm">{c.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function CollaborateurSlide() {
  return (
    <div className="h-full flex flex-col justify-center px-16 max-w-6xl mx-auto bg-background">
      <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-gd-navy/10 text-gd-navy text-xs font-bold uppercase tracking-wider mb-3">Vue commercial</span>
        <h2 className="text-5xl font-extrabold text-gd-navy-dark mb-3">Espace collaborateur gamifié</h2>
        <p className="text-lg text-muted-foreground">Un écran unique, sans défilement, qui pousse à l'action</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-6">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card border border-border shadow-xl p-6">
          <div className="flex justify-around mb-4">
            <RingMock label="RDV" value={68} color="text-gd-navy" />
            <RingMock label="Ventes" value={45} color="text-gd-orange" />
            <RingMock label="Badges" value={80} color="text-emerald-500" />
          </div>
          <p className="text-xs text-muted-foreground text-center">Anneaux de progression en temps réel</p>
        </motion.div>
        <div className="space-y-4">
          <FeatureRow icon={Flame} title="Appétence motivante" desc="À saisir · À cultiver · À explorer — jamais négatif" />
          <FeatureRow icon={Trophy} title="Classement & badges" desc="Émulation entre commerciaux, badges débloqués" />
          <FeatureRow icon={Zap} title="Action directe" desc="RDV en 1 clic · ventes reprises automatiquement de WhatsApp" />
        </div>
      </div>
    </div>
  );
}

function RingMock({ label, value, color }) {
  return (
    <div className="text-center">
      <div className="relative h-20 w-20 mx-auto">
        <svg className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
          <motion.circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
            className={color} strokeDasharray={214} initial={{ strokeDashoffset: 214 }} animate={{ strokeDashoffset: 214 - (214 * value / 100) }} transition={{ delay: 0.5, duration: 1 }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-extrabold text-gd-navy-dark">{value}%</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function FeatureRow({ icon: Icon, title, desc }) {
  return (
    <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
      className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gd-navy text-white shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-bold text-gd-navy-dark">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </motion.div>
  );
}

function CoachSlide() {
  const cards = [
    { icon: Flame, title: "À saisir — appelez en priorité", desc: "Score 89/100. Meilleure opportunité du jour.", color: "bg-emerald-500" },
    { icon: Tractor, title: "Tracteur de 10 ans — renouvellement", desc: "T5.120 de 2016. Moment idéal pour proposer un T7.", color: "bg-gd-orange" },
    { icon: Target, title: "Probabilité de conversion : 89%", desc: "Calculée sur appétence, matériel, CA et statut.", color: "bg-gd-navy" }
  ];
  return (
    <div className="h-full flex flex-col justify-center px-16 max-w-6xl mx-auto bg-background">
      <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-gd-navy/10 text-gd-navy text-xs font-bold uppercase tracking-wider mb-3">Innovation</span>
        <h2 className="text-5xl font-extrabold text-gd-navy-dark mb-3">Coach Commercial IA</h2>
        <p className="text-lg text-muted-foreground">Un assistant intelligent sur chaque fiche client</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-8 items-center">
        <div className="space-y-3">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.15 }}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.color} text-white shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gd-navy-dark text-sm">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}
          className="rounded-2xl bg-gradient-to-br from-gd-navy to-gd-navy-dark p-8 text-center text-white">
          <Lightbulb className="h-12 w-12 text-gd-orange mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Prêt à l'action</h3>
          <p className="text-white/70 text-sm">Le coach analyse le parc matériel, l'historique commercial, l'appétence et le statut pour suggérer la meilleure action — maintenant.</p>
          <div className="mt-6 flex justify-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">Règle-basé</span>
            <span className="px-3 py-1 rounded-full bg-gd-orange/20 text-gd-orange text-xs font-semibold">IA conversationnelle (semaine 2)</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function GrandEcranSlide() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-16 text-center bg-gd-navy-dark">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-gd-orange/20 text-gd-orange text-xs font-bold uppercase tracking-wider mb-4">Séminaire 13–14 octobre</span>
        <h2 className="text-6xl font-extrabold text-white mb-4">Grand Écran</h2>
        <p className="text-xl text-white/60 max-w-2xl">Une vue de projection temps réel pour motiver la salle</p>
      </motion.div>
      <div className="flex gap-6">
        <GrandEcranCard icon={Calendar} value="36" label="RDV du sprint" color="text-gd-orange" />
        <GrandEcranCard icon={ShoppingBag} value="12" label="Ventes" color="text-emerald-400" />
        <GrandEcranCard icon={Trophy} value="Top 3" label="Classement live" color="text-gd-orange" />
      </div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
        className="mt-10 flex gap-3">
        <span className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-gd-orange" /> Compteurs géants animés</span>
        <span className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-gd-orange" /> Effets de célébration</span>
        <span className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gd-orange" /> Flux temps réel</span>
      </motion.div>
    </div>
  );
}

function GrandEcranCard({ icon: Icon, value, label, color }) {
  return (
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
      className="rounded-2xl bg-white/5 border border-white/10 p-8 w-44">
      <Icon className={`h-8 w-8 ${color} mx-auto mb-3`} />
      <p className={`text-5xl font-extrabold ${color} mb-1`}>{value}</p>
      <p className="text-sm text-white/60">{label}</p>
    </motion.div>
  );
}

function AdminSlide() {
  const modules = [
    { icon: BarChart3, title: "Vue d'ensemble", desc: "KPIs, objectifs, alertes" },
    { icon: Users, title: "Utilisateurs", desc: "Commerciaux, rôles, accès" },
    { icon: Target, title: "Affectation", desc: "Répartition géographique" },
    { icon: ShoppingBag, title: "Ventes", desc: "Validation, suivi CA" },
    { icon: Trophy, title: "Badges", desc: "Gamification, conditions" },
    { icon: Wrench, title: "Offres magasin", desc: "Promotions, CA réalisé" }
  ];
  return (
    <div className="h-full flex flex-col justify-center px-16 max-w-6xl mx-auto bg-background">
      <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-gd-navy/10 text-gd-navy text-xs font-bold uppercase tracking-wider mb-3">Vue direction</span>
        <h2 className="text-5xl font-extrabold text-gd-navy-dark mb-3">Pilotage & administration</h2>
        <p className="text-lg text-muted-foreground">Tout le contrôle, organisé par modules</p>
      </motion.div>
      <div className="grid grid-cols-3 gap-4">
        {modules.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <Icon className="h-7 w-7 text-gd-orange mb-3" />
              <h3 className="font-bold text-gd-navy-dark">{m.title}</h3>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ResultatsSlide({ stats }) {
  const kpis = [
    { icon: Users, value: stats.clients, label: "Clients qualifiés" },
    { icon: Calendar, value: stats.rdv, label: "RDV planifiés" },
    { icon: ShoppingBag, value: stats.ventes, label: "Ventes déclarées" },
    { icon: Trophy, value: stats.badges, label: "Badges débloqués" }
  ];
  return (
    <div className="h-full flex flex-col justify-center px-16 max-w-5xl mx-auto">
      <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="text-5xl font-extrabold text-white mb-3">La plateforme en chiffres</motion.h2>
      <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-xl text-white/60 mb-12">Données réelles de l'opération</motion.p>
      <div className="grid grid-cols-4 gap-6">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={i} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.1 }}
              className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
              <Icon className="h-8 w-8 text-gd-orange mx-auto mb-3" />
              <p className="text-4xl font-extrabold text-white mb-1">{k.value}</p>
              <p className="text-sm text-white/60">{k.label}</p>
            </motion.div>
          );
        })}
      </div>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
        className="mt-10 flex justify-center gap-3">
        <span className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Opérationnel
        </span>
        <span className="px-4 py-2 rounded-lg bg-gd-orange/20 text-gd-orange text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Prêt pour le sprint
        </span>
      </motion.div>
    </div>
  );
}

function RoadmapSlide() {
  const steps = [
    { phase: "Maintenant", title: "Déploiement & prise en main", desc: "Import des affectations, formation des commerciaux", done: true },
    { phase: "Semaine 1", title: "Lancement du sprint RDV", desc: "Suivi temps réel via le Grand Écran", done: false },
    { phase: "13–14 oct", title: "Séminaire 50 ans", desc: "Projection en direct, célébration des résultats", done: false },
    { phase: "Après", title: "Bilan & pérennisation", desc: "Analyse des conversions, ajustements, déploiement durable", done: false }
  ];
  return (
    <div className="h-full flex flex-col justify-center px-16 max-w-5xl mx-auto">
      <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="text-5xl font-extrabold text-white mb-3">Feuille de route</motion.h2>
      <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-xl text-white/60 mb-12">Du déploiement au séminaire</motion.p>
      <div className="space-y-4">
        {steps.map((s, i) => (
          <motion.div key={i} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.12 }}
            className="flex items-center gap-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full shrink-0 ${s.done ? 'bg-emerald-500' : 'bg-white/10 border-2 border-white/20'}`}>
              {s.done ? <CheckCircle2 className="h-6 w-6 text-white" /> : <span className="text-white/60 font-bold">{i + 1}</span>}
            </div>
            <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">{s.title}</h3>
                <span className="text-xs font-semibold text-gd-orange uppercase tracking-wider">{s.phase}</span>
              </div>
              <p className="text-sm text-white/60 mt-1">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        className="text-center text-gd-orange text-lg font-bold mt-10">Fêtons les 50 ans ensemble. 🚜</motion.p>
    </div>
  );
}