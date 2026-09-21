import React, { useState } from 'react';

// Logo de l'opération. Sert le fichier public/logo-op.png (servi à /logo-op.png).
// Si le fichier n'est pas (encore) présent, on affiche `fallback` (icône/texte existant) — aucun visuel cassé.
export default function OpLogo({ className = '', fallback = null, alt = '50 ans Gonnin Duris × New Holland' }) {
  const [ok, setOk] = useState(true);
  if (!ok) return fallback;
  return (
    <img
      src="/logo-op.png"
      alt={alt}
      className={className}
      onError={() => setOk(false)}
      draggable={false}
    />
  );
}
