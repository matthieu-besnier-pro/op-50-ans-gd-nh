import React from 'react';
import { Image } from '@/components/ui/image';
import { Smartphone } from 'lucide-react';

// Lien d'accès à l'outil — la cible du flashcode (à remplacer par le domaine personnalisé le jour J).
const LIEN = 'https://op-50-ans-gd-nh.base44.app';
const FLASHCODE = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=8&data=${encodeURIComponent(LIEN)}`;

// Flashcode + lien texte : la dernière chose que la salle retient de la séance.
export default function FlashCode() {
  return (
    <div className="flex w-full max-w-2xl items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
      <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-lg">
        <Image
          src={FLASHCODE}
          alt="Flashcode vers CockpitOP"
          fittingType="fit"
          className="h-28 w-28 md:h-32 md:w-32"
        />
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-gd-orange">
          <Smartphone className="h-3.5 w-3.5" /> Flashcode
        </p>
        <p className="text-xl font-bold text-white md:text-2xl">Scannez, vous êtes dans l'outil.</p>
        <a
          href={LIEN}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block break-all text-base font-semibold text-white/60 underline decoration-gd-orange/70 underline-offset-4 transition hover:text-white md:text-lg"
        >
          {LIEN}
        </a>
      </div>
    </div>
  );
}