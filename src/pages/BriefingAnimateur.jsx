import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import OpLogo from '@/components/OpLogo';
import { PARCOURS } from '@/lib/parcoursOperation';
import {
  Printer, Presentation as PresentationIcon, MessageSquare,
  Monitor, AlertTriangle, ArrowRight, Clock, Users
} from 'lucide-react';

/**
 * Script de l'animateur : le fil à suivre à l'oral, de l'inscription du
 * commercial jusqu'à la vente. Même parcours que la vue Présentation.
 * Conçu pour être imprimé et tenu en main pendant la démonstration.
 */
export default function BriefingAnimateur() {
  return (
    <div className="min-h-screen bg-background">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-gd-navy-dark px-6 py-3 text-white print:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-gd-orange" />
          Script animateur — CockpitOP
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

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* En-tête */}
        <header className="mb-10 border-b-2 border-gd-orange/30 pb-8">
          <div className="flex items-start gap-5">
            <OpLogo className="h-16 w-16 shrink-0 rounded-2xl object-contain" fallback={null} />
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold text-gd-navy-dark">
                Script animateur
              </h1>
              <p className="mt-1 text-lg text-muted-foreground">
                De l'inscription du commercial jusqu'à la vente
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-gd-orange">
                Opération 50 ans Gonnin Duris × New Holland · 13 au 30 octobre 2026
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Consigne icon={Clock} titre="Format">
              Neuf étapes, environ vingt minutes. Une étape = un écran.
            </Consigne>
            <Consigne icon={Users} titre="Public">
              Commerciaux, responsables, atelier. Parlez gestes, pas fonctionnalités.
            </Consigne>
            <Consigne icon={Monitor} titre="Méthode">
              Montrez en direct. Chaque étape se démontre en moins d'une minute.
            </Consigne>
          </div>

          <div className="mt-5 rounded-xl border-l-4 border-gd-orange bg-gd-orange/5 p-4">
            <p className="text-sm font-semibold text-gd-navy-dark">Règle du jour</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ne mettez aucun compteur en avant. On ne vend pas un tableau de bord :
              on montre qu'un commercial entre, appelle, pose un rendez-vous et vend
              sans jamais perdre le fil. Les chiffres viendront d'eux-mêmes après l'opération.
            </p>
          </div>
        </header>

        {/* Le fil */}
        <nav className="mb-10 rounded-xl border border-border bg-card p-5 print:break-inside-avoid">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Le fil à tenir
          </p>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {PARCOURS.map((e, i) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="rounded-lg bg-gd-navy px-2.5 py-1 font-semibold text-white">
                  {i + 1}. {e.etape}
                </span>
                {i < PARCOURS.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Étapes */}
        {PARCOURS.map((e, i) => (
          <EtapeScript key={e.id} etape={e} num={i + 1} />
        ))}

        {/* Clôture */}
        <section className="mt-12 rounded-2xl bg-gd-navy-dark p-8 text-white print:break-inside-avoid">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gd-orange">
            Pour conclure
          </p>
          <h2 className="mb-4 text-2xl font-extrabold">
            Un outil qui se fait oublier, pour qu'ils pensent au client
          </h2>
          <p className="mb-5 text-white/70">
            Reprenez les trois promesses, dans cet ordre. C'est ce que la salle doit
            retenir en sortant :
          </p>
          <ul className="space-y-2.5">
            {[
              'Il entre sans friction — un identifiant, un mot de passe.',
              'Il appelle sans se perdre — sa liste, ses cibles, le statut d\'un clic.',
              'Il vend sans ressaisir — il annonce sur WhatsApp, l\'outil suit.'
            ].map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gd-orange" />
                <span className="text-white/90">{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-white/10 pt-5 text-sm text-white/50">
            Dernière phrase suggérée : « Le 13 au matin, vous vous connectez et vous
            appelez. Tout le reste, c'est notre affaire. »
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

function EtapeScript({ etape, num }) {
  const Icon = etape.icon;
  const { dire, montrer, ecueil } = etape.animateur;

  return (
    <section className="mb-8 print:break-inside-avoid">
      {/* Titre d'étape */}
      <div className="mb-4 flex items-center gap-3 border-b-2 border-gd-orange/30 pb-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gd-navy text-lg font-extrabold text-white">
          {num}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gd-orange">
            {etape.etape}
          </p>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gd-navy-dark">
            <Icon className="h-5 w-5 shrink-0 text-gd-orange" />
            {etape.titre}
          </h2>
        </div>
        <code className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-gd-navy">
          {etape.ecran}
        </code>
      </div>

      {/* Ce que vous dites */}
      <div className="mb-3 rounded-xl border-l-4 border-gd-navy bg-gd-navy/5 p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gd-navy">
          <MessageSquare className="h-3.5 w-3.5" /> Ce que vous dites
        </p>
        <p className="text-[15px] italic leading-relaxed text-gd-navy-dark">« {dire} »</p>
      </div>

      {/* Ce que vous montrez */}
      <div className="mb-3 rounded-xl border border-border bg-card p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Monitor className="h-3.5 w-3.5 text-gd-orange" /> Ce que vous montrez
        </p>
        <p className="text-sm text-foreground">{montrer}</p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {etape.points.map((p) => (
            <li key={p} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gd-orange" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {/* Le point de vigilance */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5" /> À ne pas rater
        </p>
        <p className="text-sm text-amber-900">{ecueil}</p>
      </div>
    </section>
  );
}
