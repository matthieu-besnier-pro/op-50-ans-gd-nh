import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import OpLogo from '@/components/OpLogo';
import { PARCOURS } from '@/lib/parcoursOperation';
import { ArrowRight, ArrowLeft, Check, X } from 'lucide-react';

// Déroulé : ouverture → carte du parcours → une étape par écran → conclusion.
const SLIDES = ['hero', 'carte', ...PARCOURS.map((e) => e.id), 'fin'];

export default function Presentation() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev, navigate]);

  const id = SLIDES[current];
  const etape = PARCOURS.find((e) => e.id === id);
  const indexEtape = PARCOURS.findIndex((e) => e.id === id);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gd-navy-dark select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={id}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {id === 'hero' && <Hero />}
          {id === 'carte' && <Carte />}
          {etape && <Etape etape={etape} index={indexEtape} />}
          {id === 'fin' && <Fin />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4">
        <button
          onClick={prev}
          disabled={current === 0}
          aria-label="Écran précédent"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 disabled:opacity-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s}
              onClick={() => setCurrent(i)}
              aria-label={`Écran ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === current ? 'w-8 bg-gd-orange' : 'w-2 bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          disabled={current === SLIDES.length - 1}
          aria-label="Écran suivant"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark transition-all hover:bg-gd-orange/80 disabled:opacity-30"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <button
        onClick={() => navigate('/')}
        className="absolute right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/20 hover:text-white"
      >
        <X className="h-3.5 w-3.5" /> Quitter
      </button>
    </div>
  );
}

/* ---------- Ouverture ---------- */

function Hero() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="mb-8"
      >
        <OpLogo className="h-28 w-28 rounded-3xl object-contain" fallback={null} />
      </motion.div>

      <motion.h1
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mb-5 text-6xl font-extrabold leading-tight text-white md:text-7xl"
      >
        Cockpit<span className="text-gd-orange">OP</span>
      </motion.h1>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="mb-6 h-1.5 w-28 rounded-full bg-gd-orange"
        style={{ transform: 'skewX(-12deg)' }}
      />

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-gd-orange"
      >
        Opération 50 ans Gonnin Duris × New Holland
      </motion.p>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.75 }}
        className="max-w-2xl text-xl text-white/60"
      >
        Du 13 au 30 octobre 2026
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-14 text-base text-white/40"
      >
        De l'inscription du commercial jusqu'à la vente
      </motion.p>
    </div>
  );
}

/* ---------- Carte du parcours ---------- */

function Carte() {
  return (
    <div className="flex h-full flex-col justify-center px-10 md:px-20">
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-gd-orange"
      >
        Le parcours
      </motion.p>
      <motion.h2
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-12 text-4xl font-extrabold text-white md:text-5xl"
      >
        Neuf moments, une seule ligne droite
      </motion.h2>

      <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
        {PARCOURS.map((e, i) => {
          const Icon = e.icon;
          return (
            <motion.div
              key={e.id}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.07 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gd-orange/15">
                <Icon className="h-5 w-5 text-gd-orange" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                {String(i + 1).padStart(2, '0')}
              </p>
              <p className="mt-1 font-bold leading-snug text-white">{e.etape}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Une étape ---------- */

function Etape({ etape, index }) {
  const Icon = etape.icon;
  return (
    <div className="flex h-full items-center px-10 md:px-24">
      <div className="grid w-full items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        {/* Discours */}
        <div>
          <motion.div
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="mb-6 flex items-center gap-4"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gd-orange">
              <Icon className="h-7 w-7 text-gd-navy-dark" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                Étape {String(index + 1).padStart(2, '0')}
              </p>
              <p className="text-lg font-bold text-gd-orange">{etape.etape}</p>
            </div>
          </motion.div>

          <motion.h2
            initial={{ y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="mb-5 text-4xl font-extrabold leading-tight text-white md:text-5xl"
          >
            {etape.titre}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.24 }}
            className="max-w-xl text-xl leading-relaxed text-white/60"
          >
            {etape.accroche}
          </motion.p>
        </div>

        {/* Ce que ça change */}
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Ce que ça change
          </p>
          <ul className="space-y-5">
            {etape.points.map((p, i) => (
              <motion.li
                key={p}
                initial={{ x: 16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.42 + i * 0.1 }}
                className="flex gap-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gd-orange/20">
                  <Check className="h-3.5 w-3.5 text-gd-orange" />
                </span>
                <span className="text-lg leading-snug text-white/85">{p}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

/* ---------- Conclusion ---------- */

function Fin() {
  const promesses = [
    'Il entre sans friction',
    'Il appelle sans se perdre',
    'Il vend sans ressaisir'
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 text-center">
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-gd-orange"
      >
        En une phrase
      </motion.p>

      <motion.h2
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="mb-14 max-w-4xl text-5xl font-extrabold leading-tight text-white md:text-6xl"
      >
        Un outil qui se fait oublier,<br />
        <span className="text-gd-orange">pour qu'ils pensent au client</span>
      </motion.h2>

      <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
        {promesses.map((p, i) => (
          <motion.div
            key={p}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.12 }}
            className="rounded-full border border-gd-orange/30 bg-gd-orange/10 px-6 py-3 text-lg font-semibold text-white"
          >
            {p}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="flex flex-col items-center gap-4"
      >
        <OpLogo className="h-16 w-16 rounded-2xl object-contain" fallback={null} />
        <p className="text-sm uppercase tracking-[0.25em] text-white/40">
          50 ans Gonnin Duris × New Holland
        </p>
      </motion.div>
    </div>
  );
}
