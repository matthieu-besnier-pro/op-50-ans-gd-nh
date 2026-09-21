import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import OpLogo from '@/components/OpLogo';
import { Zap } from 'lucide-react';

const MESSAGES = [
  'On attelle les données…',
  'On sème les prospects…',
  'On fait le plein de RDV…',
  'On lustre le tableau de bord…',
  'Presque prêt à moissonner 🌾'
];

// Chargement gamifié et brandé (CockpitOP) : logo, tracteur qui avance, messages qui tournent.
export default function Loader({ label }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (label) return; // message fixe fourni → pas de rotation
    const t = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, [label]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8">
      <OpLogo
        className="h-20 w-20 rounded-full object-contain animate-pulse"
        fallback={<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gd-navy text-white animate-pulse"><Zap className="h-8 w-8 text-gd-orange" /></div>}
      />

      {/* Piste + tracteur */}
      <div className="relative h-9 w-64 overflow-hidden">
        <div className="absolute bottom-1.5 left-0 right-0 border-b-2 border-dashed border-gd-navy/20" />
        <motion.div
          className="absolute bottom-0 text-2xl"
          initial={{ x: -32 }}
          animate={{ x: 272 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        >
          🚜
        </motion.div>
      </div>

      {/* Barre de progression indéterminée */}
      <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute top-0 h-full w-1/3 rounded-full bg-gd-orange"
          animate={{ left: ['-35%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <p className="text-sm font-semibold text-gd-navy-dark">{label || MESSAGES[i]}</p>
    </div>
  );
}
