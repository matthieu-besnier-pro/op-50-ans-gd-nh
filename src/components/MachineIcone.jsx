import React from 'react';

/**
 * Visuels des familles de matériel de l'opération.
 *
 * Les huit familles ont leur photo produit : cinq viennent du tableau de suivi
 * 2021 de la maison, trois ont été fournies ensuite. Toutes redimensionnées
 * pour le web — une cinquantaine de kilo-octets chacune.
 *
 * Les silhouettes SVG restent en dessous, en filet : si une image venait à
 * manquer, le dessin prend le relais plutôt que de laisser un trou. Elles
 * servent aussi de repère pour une famille qu'on ajouterait demain.
 *
 * Chaque silhouette garde le trait qui fait reconnaître la machine : la grande
 * roue arrière du tracteur, le bras du télescopique, la coupe de la
 * moissonneuse, la goulotte de l'ensileuse, la botte ronde ou carrée de la
 * presse, le portique de la machine à vendanger, le satellite du guidage.
 */

// Photos produit disponibles, par famille.
const PHOTOS = {
  Tracteur: 'tracteur.png',
  Moissonneuse: 'moissonneuse.png',
  Ensileuse: 'ensileuse.png',
  'Round Baler': 'round-baler.png',
  'Big Baler': 'big-baler.png',
  'Télescopique': 'telescopique.png',
  'Machine à vendanger': 'machine-a-vendanger.png',
  'Agri. précision': 'agri-precision.png'
};

const Roue = ({ cx, cy, r }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="2.5" />
    <circle cx={cx} cy={cy} r={Math.max(r - 4, 1.5)} fill="currentColor" opacity="0.35" />
  </>
);

const DESSINS = {
  Tracteur: (
    <>
      <path d="M14 26V16h10l4-7h10v17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M38 19h10v7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <Roue cx={17} cy={28} r={8} />
      <Roue cx={45} cy={30} r={5} />
    </>
  ),
  'Télescopique': (
    <>
      <path d="M10 30v-9h18v9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 21l6-7h6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 20l24-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 11l4 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <Roue cx={14} cy={31} r={5} />
      <Roue cx={30} cy={31} r={5} />
    </>
  ),
  Moissonneuse: (
    <>
      <path d="M20 26V14h16v12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M36 18h8v8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20 22H8v6h12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 22l-3-5M12 22l-2-6M16 22l-1-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <Roue cx={26} cy={29} r={6} />
      <Roue cx={43} cy={30} r={4} />
    </>
  ),
  Ensileuse: (
    <>
      <path d="M18 27V15h16v12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 15l10-6 4 3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M18 23H8v5h10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <Roue cx={24} cy={30} r={6} />
      <Roue cx={40} cy={30} r={4} />
    </>
  ),
  'Round Baler': (
    <>
      <path d="M8 28h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 28V20h6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={38} cy={21} r={11} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx={38} cy={21} r={5} fill="currentColor" opacity="0.35" />
      <Roue cx={26} cy={31} r={4} />
    </>
  ),
  'Big Baler': (
    <>
      <path d="M8 28h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x={16} y={12} width={32} height={18} rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M26 12v18M36 12v18" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <Roue cx={24} cy={32} r={4} />
      <Roue cx={42} cy={32} r={4} />
    </>
  ),
  'Machine à vendanger': (
    <>
      <path d="M12 32V12h28v20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 32V22h16v10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 16h8v6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <Roue cx={14} cy={32} r={4} />
      <Roue cx={38} cy={32} r={4} />
    </>
  ),
  'Agri. précision': (
    <>
      <circle cx={32} cy={13} r={4} fill="currentColor" />
      <path d="M24 21a11 11 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M19 27a18 18 0 0 1 26 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <path d="M32 29v5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 34h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  )
};

export default function MachineIcone({ famille, className = 'h-7 w-11', titre }) {
  const photo = PHOTOS[famille];
  if (photo) {
    // L'application peut être servie sous un sous-chemin : on part de sa base.
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    return (
      <img
        src={`${base}machines/${photo}`}
        alt={titre || famille}
        title={titre || famille}
        loading="lazy"
        className={`${className} object-contain`}
      />
    );
  }

  const dessin = DESSINS[famille];
  if (!dessin) return null;
  return (
    <svg
      viewBox="0 0 56 40"
      className={className}
      role="img"
      aria-label={titre || famille}
      focusable="false"
    >
      <title>{titre || famille}</title>
      {dessin}
    </svg>
  );
}
