import React from 'react';
import OpLogo from '@/components/OpLogo';
import HorlogeEcran from '@/components/HorlogeEcran';
import TeleventeOuest from '@/components/TeleventeOuest';

/**
 * Télévente Huile & Graisse — vue PUBLIQUE.
 *
 * Consultable sans compte et sans menu, comme le suivi des ventes : le lien
 * se partage à tout le monde, y compris à qui n'a jamais ouvert l'outil.
 *
 * Aucun appel réseau : le relevé de la télévente est figé, il n'y a rien à
 * aller chercher. La page s'affiche donc instantanément, même sur un
 * téléphone en bord de champ.
 */

export default function TeleventePublic() {
  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-5">
        <OpLogo className="h-12 w-12 rounded-full object-contain" fallback={null} />
        <div>
          <h1 className="text-xl font-extrabold leading-none">Télévente Huile &amp; Graisse</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-gd-orange">Secteur Ouest</p>
        </div>
        <HorlogeEcran className="ml-auto" />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <TeleventeOuest titre="Résultats par point de vente" />
      </main>
    </div>
  );
}
