import React from 'react';
import { Satellite, Cog } from 'lucide-react';

// Planche de pictogrammes New Holland fournie (3 colonnes × 2 lignes).
const SPRITE = 'https://media.base44.com/images/public/6a9a7c60d4571b787297711a/674f83394_9d8060d4-357a-44f1-83a9-587d27370428.png';
// Pictogramme dédié du télescopique (fichier séparé).
const TELESCOPIQUE = 'https://media.base44.com/images/public/6a9a7c60d4571b787297711a/e1a62b849_acaa74fa-325e-40ba-8d14-875038c27b31.png';

// Emplacement de chaque catégorie dans la planche : [colonne, ligne]
const CASES = {
  MB: [0, 0],
  'BB-RB': [2, 0],
  ENSILEUSES: [0, 1],
  MAV: [1, 1],
  TRACTEURS: [2, 1],
};

// Pictogramme d'une catégorie d'opération.
export default function CategorieIcone({ categorie, size = 24, className = '' }) {
  const cell = CASES[categorie];
  const style = { width: size, height: size };

  if (categorie === 'TELESCOPIQUES') {
    style.backgroundImage = `url(${TELESCOPIQUE})`;
    style.backgroundSize = 'contain';
    style.backgroundPosition = 'center';
  } else if (cell) {
    style.backgroundImage = `url(${SPRITE})`;
    style.backgroundSize = '300% 200%';
    style.backgroundPosition = `${cell[0] * 50}% ${cell[1] * 100}%`;
  }

  return (
    <span className={`inline-block shrink-0 bg-no-repeat align-middle ${className}`} style={style} aria-hidden="true">
      {!cell && categorie !== 'TELESCOPIQUES' && (categorie === 'AGRI PRECISION'
        ? <Satellite size={size} className="text-gd-navy" />
        : <Cog size={size} className="text-gd-navy" />)}
    </span>
  );
}