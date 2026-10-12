import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import OpLogo from '@/components/OpLogo';
import { GESTES } from '@/lib/gestesOperation';
import {
  Printer, Presentation as PresentationIcon, MessageSquare,
  Monitor, Clock, Users, ArrowRight
} from 'lucide-react';

/**
 * Mémo animateur : une page, quatre gestes. Le strict nécessaire pour tenir
 * cinq minutes devant des commerciaux. Conçu pour être imprimé.
 */
export default function BriefingAnimateur() {
  return (
    <div className="min-h-screen bg-background">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-gd-navy-dark px-6 py-3 text-white print:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-gd-orange" />
          Mémo animateur — CockpitOP
        </span>
        <div className="flex items-center gap-2">
          <Link to="/presentation">
            <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white">
              <PresentationIcon className="h-4 w-4 mr-1.5" /> Lancer la présentation
            </Button>
          </Link>
          <Link to="/tableau-de-bord">
            <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white">
              Retour à l'app
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-gd-orange text-gd-navy-dark hover:bg-gd-orange/90"
          >
            <Printer className="h-4 w-4 mr-1.5" /> Imprimer
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* En-tête */}
        <header className="mb-6 flex items-start gap-4 border-b-2 border-gd-orange/30 pb-6">
          <OpLogo className="h-14 w-14 shrink-0 rounded-2xl object-contain" fallback={null} />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold text-gd-navy-dark">Mémo animateur</h1>
            <p className="mt-1 text-lg text-muted-foreground">
              Séance du 13 octobre au matin. Devant des commerciaux : leurs 4 gestes, rien d'autre.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-gd-orange">
              Opération 50 ans Gonnin Duris × New Holland · 13 au 30 octobre 2026
            </p>
          </div>
        </header>

        {/* Les 3 consignes */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Consigne icon={Clock} titre="Format">
            Cinq minutes. Un geste = un écran, moins d'une minute chacun.
          </Consigne>
          <Consigne icon={Users} titre="Public">
            Des commerciaux. Parlez geste et temps gagné, jamais fonctionnalité.
          </Consigne>
          <Consigne icon={Monitor} titre="Méthode">
            Vous montrez en direct, ils font un geste. Pas de slides à commenter.
          </Consigne>
        </div>

        <div className="mb-6 rounded-xl border-l-4 border-gd-orange bg-gd-orange/5 p-4">
          <p className="text-sm font-semibold text-gd-navy-dark">Règle du jour</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aucun compteur à l'écran. On ne présente pas un tableau de bord : on montre
            qu'un commercial se connecte, appelle, pose un rendez-vous et vend sans
            jamais perdre le fil. Les chiffres viendront d'eux-mêmes.
          </p>
        </div>

        {/* Le fil */}
        <nav className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm print:break-inside-avoid">
          <span className="mr-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Le fil à tenir
          </span>
          {GESTES.map((g, i) => (
            <span key={g.id} className="flex items-center gap-2">
              <span className="rounded-lg bg-gd-navy px-2.5 py-1 font-semibold text-white">
                {g.num}. {g.geste}
              </span>
              {i < GESTES.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
          ))}
        </nav>

        {/* Les 4 gestes */}
        <div className="space-y-3">
          {GESTES.map((g) => (
            <GesteScript key={g.id} geste={g} />
          ))}
        </div>

        {/* Clôture */}
        <section className="mt-8 rounded-2xl bg-gd-navy-dark p-6 text-white print:break-inside-avoid">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-gd-orange">
            Pour conclure
          </p>
          <h2 className="mb-4 text-2xl font-extrabold">
            Le 13 au matin, vous vous connectez et vous appelez.
          </h2>
          <ul className="space-y-2">
            {GESTES.map((g) => (
              <li key={g.id} className="flex gap-3 text-white/90">
                <span className="font-bold text-gd-orange">{g.num}</span>
                <span><span className="font-semibold text-white">{g.geste}</span> — {g.titre}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-white/10 pt-4 text-sm text-white/60">
            Dernière phrase, telle quelle : « Tout le reste, c'est notre affaire. »
          </p>
        </section>
      </div>
    </div>
  );
}

function Consigne({ icon: Icon, titre, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gd-navy">
        <Icon className="h-3.5 w-3.5 text-gd-orange" /> {titre}
      </p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function GesteScript({ geste }) {
  const Icon = geste.icon;
  const { dire, montrer, reflexe } = geste.animateur;

  return (
    <section className="rounded-xl border border-border bg-card p-4 print:break-inside-avoid">
      {/* Titre */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gd-navy font-extrabold text-white">
          {geste.num}
        </div>
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold text-gd-navy-dark">
          <Icon className="h-5 w-5 shrink-0 text-gd-orange" />
          {geste.geste}
          <span className="truncate text-sm font-normal text-muted-foreground">— {geste.titre}</span>
        </h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Ce que vous dites */}
        <div className="rounded-lg border-l-4 border-gd-navy bg-gd-navy/5 p-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gd-navy">
            Ce que vous dites
          </p>
          <p className="text-sm italic leading-snug text-gd-navy-dark">« {dire} »</p>
        </div>

        {/* Ce que vous montrez */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Ce que vous montrez
          </p>
          <p className="text-sm leading-snug text-foreground">{montrer}</p>
        </div>

        {/* Le réflexe */}
        <div className="rounded-lg border border-gd-orange/30 bg-gd-orange/5 p-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gd-orange">
            Le réflexe
          </p>
          <p className="text-sm leading-snug text-foreground">{reflexe}</p>
        </div>
      </div>
    </section>
  );
}