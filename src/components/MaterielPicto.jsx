import React from 'react';

// Pictogrammes par catégorie d'opération (categorie_op) — visualisation rapide du parc.
// Les clés sont normalisées (majuscules, sans accents) pour tolérer les variantes d'import.
export const CATEGORIES = {
  TRACTEURS: { emoji: '🚜', label: 'Tracteurs' },
  MB: { emoji: '🌾', label: 'Moissonneuses-batteuses' },
  'BB-RB': { emoji: '🟡', label: 'Presses (BB / RB)' },
  TELESCOPIQUES: { emoji: '🏗️', label: 'Télescopiques' },
  ENSILEUSES: { emoji: '🌽', label: 'Ensileuses' },
  MAV: { emoji: '🔧', label: 'Matériel avant / MAV' },
  'AGRI PRECISION': { emoji: '🛰️', label: 'Agriculture de précision' },
  AUTRES: { emoji: '⚙️', label: 'Autres matériels' },
};

// Usages — couleur + libellé. Sert à répartir le parc "selon les usages".
export const USAGES = {
  commerce: { label: 'Commerce', emoji: '🚜', chip: 'border-gd-orange/30 bg-gd-orange/10 text-gd-orange' },
  atelier: { label: 'Atelier / récolte', emoji: '🔧', chip: 'border-sky-300 bg-sky-50 text-sky-700' },
  agri_precision: { label: 'Agri. précision', emoji: '🛰️', chip: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
};

const normalize = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();

export function categorieMeta(categorie_op) {
  const n = normalize(categorie_op);
  // Correspondance directe
  for (const [key, meta] of Object.entries(CATEGORIES)) {
    if (normalize(key) === n) return meta;
  }
  // Heuristiques de repli
  if (n.includes('PRECISION')) return CATEGORIES['AGRI PRECISION'];
  if (n.includes('TRACT')) return CATEGORIES.TRACTEURS;
  if (n.includes('TELESC')) return CATEGORIES.TELESCOPIQUES;
  if (n.includes('ENSIL')) return CATEGORIES.ENSILEUSES;
  if (n.startsWith('MB') || n.includes('BATTEUSE') || n.includes('MOISSON')) return CATEGORIES.MB;
  if (n.includes('RB') || n.includes('BB') || n.includes('PRESSE')) return CATEGORIES['BB-RB'];
  return CATEGORIES.AUTRES;
}

// Pictogramme d'une machine (catégorie d'opération).
export function MaterielPicto({ categorie_op, size = 'md', className = '' }) {
  const meta = categorieMeta(categorie_op);
  const px = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <span className={`leading-none ${px} ${className}`} title={meta.label} role="img" aria-label={meta.label}>
      {meta.emoji}
    </span>
  );
}

// Puce d'usage (commerce / atelier / agri_precision).
export function UsageChip({ usage, className = '' }) {
  const meta = USAGES[usage];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.chip} ${className}`}>
      <span role="img" aria-hidden="true">{meta.emoji}</span> {meta.label}
    </span>
  );
}

// Les usages d'un client, sous forme de puces (répartition selon les usages).
export function UsagesClient({ usages, className = '' }) {
  const list = Array.isArray(usages) ? usages : [];
  if (list.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {list.map((u) => <UsageChip key={u} usage={u} />)}
    </div>
  );
}

export default MaterielPicto;
