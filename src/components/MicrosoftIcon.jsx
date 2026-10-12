import React from 'react';

// Logo Microsoft (4 carrés) — utilisé pour la connexion Microsoft 365.
export default function MicrosoftIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}