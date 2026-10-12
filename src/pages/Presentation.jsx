import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import OpLogo from '@/components/OpLogo';
import { GESTES } from '@/lib/gestesOperation';
import { ArrowRight, ArrowLeft, Check, X } from 'lucide-react';

// Déroulé court : ouverture → les 4 gestes d'un coup d'œil → un geste par écran → conclusion.
const SLIDES = ['hero', 'apercu', ...GESTES.map((g) => g.id), 'fin'];

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
  const geste = GESTES.find((g) => g.id === id);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gd-navy-dark select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={id}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {id === 'hero' && <Hero />}
          {id === 'apercu' && <Apercu />}
          {geste && <GesteSlide geste={geste} />}
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

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-gd-orange"
      >
        Cockpit<span className="text-white">OP</span> · vos outils de l'opération
      </motion.p>

      <motion.h1
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mb-5 text-6xl font-extrabold leading-tight text-white md:text-7xl"
      >
        Votre journée,<br />
        <span className="text-gd-orange">en 4 gestes</span>
      </motion.h1>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="mb-6 h-1.5 w-28 rounded-full bg-gd-orange"
        style={{ transform: 'skewX(-12deg)' }}
      />

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-lg text-white/60"
      >
        Du 13 au 30 octobre 2026
      </motion.p>
    </div>
  );
}

/* ---------- Les 4 gestes d'un coup d'œil ---------- */

function Apercu() {
  return (
    <div className="flex h-full flex-col justify-center px-10 md:px-20">
      <motion.h2
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-10 text-4xl font-extrabold text-white md:text-5xl"
      >
        Quatre gestes, rien d'autre à retenir
      </motion.h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GESTES.map((g, i) => {
          const Icon = g.icon;
          return (
            <motion.div
              key={g.id}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gd-orange/15">
                <Icon className="h-6 w-6 text-gd-orange" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{g.num}</p>
              <p className="mt-1 text-xl font-bold text-white">{g.geste}</p>
              <p className="mt-2 text-sm leading-snug text-white/60">{g.accroche}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Un geste ---------- */

function GesteSlide({ geste }) {
  const Icon = geste.icon;
  return (
    <div className="flex h-full items-center px-10 md:px-24">
      <div className="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        {/* Le geste */}
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
                Geste {geste.num}
              </p>
              <p className="text-lg font-bold text-gd-orange">{geste.geste}</p>
            </div>
          </motion.div>

          <motion.h2
            initial={{ y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="mb-5 text-4xl font-extrabold leading-tight text-white md:text-5xl"
          >
            {geste.titre}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.24 }}
            className="max-w-xl text-xl leading-relaxed text-white/60"
          >
            {geste.accroche}
          </motion.p>
        </div>

        {/* Ce que ça vous change */}
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Ce que ça vous change
          </p>
          <ul className="space-y-5">
            {geste.points.map((p, i) => (
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
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 text-center">
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-gd-orange"
      >
        Vous n'avez que ça à retenir
      </motion.p>

      <motion.h2
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="mb-12 max-w-4xl text-5xl font-extrabold leading-tight text-white md:text-6xl"
      >
        Le 13 au matin,<br />
        <span className="text-gd-orange">vous vous connectez et vous appelez.</span>
      </motion.h2>

      <div className="mb-14 flex flex-wrap items-center justify-center gap-3">
        {GESTES.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.1 }}
            className="flex items-center gap-2 rounded-full border border-gd-orange/30 bg-gd-orange/10 px-5 py-2.5 text-lg font-semibold text-white"
          >
            <span className="text-sm font-bold text-gd-orange">{g.num}</span>
            {g.geste}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center gap-3"
      >
        <OpLogo className="h-16 w-16 rounded-2xl object-contain" fallback={null} />
        <p className="text-sm uppercase tracking-[0.25em] text-white/40">
          Tout le reste, c'est notre affaire
        </p>
      </motion.div>
    </div>
  );
}