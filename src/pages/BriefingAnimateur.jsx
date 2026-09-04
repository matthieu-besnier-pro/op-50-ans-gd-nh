import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Zap, Monitor, Calendar, Briefcase, Users, Store, Wrench,
  Settings, LayoutDashboard, Trophy, Award, Clock, Target,
  CheckCircle2, ArrowRight, Printer, Globe
} from 'lucide-react';

const APP_URL = 'https://op-50-ans-gd-nh.base44.app';

function Section({ num, icon: Icon, title, children }) {
  return (
    <section className="break-inside-avoid mb-8">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-gd-orange/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gd-navy text-white font-extrabold text-lg shrink-0">
          {num}
        </div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gd-navy-dark">
          {Icon && <Icon className="h-5 w-5 text-gd-orange" />}
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function LinkRow({ to, label, desc, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 mb-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gd-navy/10 text-gd-navy shrink-0">
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gd-navy-dark">{label}</span>
          <code className="text-xs bg-muted px-2 py-0.5 rounded text-gd-navy">{to}</code>
        </div>
        {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

export default function BriefingAnimateur() {
  return (
    <div className="min-h-screen bg-background">
      {/* Print bar */}
      <div className="sticky top-0 z-10 bg-gd-navy-dark text-white px-6 py-3 flex items-center justify-between print:hidden">
        <span className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-gd-orange" /> Briefing animateur — NH50 Pro Tracker
        </span>
        <div className="flex items-center gap-2">
          <Link to="/tableau-de-bord">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
              Retour à l'app
            </Button>
          </Link>
          <Button size="sm" variant="default" className="bg-gd-orange text-gd-navy-dark hover:bg-gd-orange/90" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 print:py-4 print:px-4">
        {/* Cover */}
        <div className="text-center mb-12 pb-8 border-b-4 border-gd-orange">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gd-navy text-white mb-4">
            <Zap className="h-9 w-9" fill="currentColor" />
          </div>
          <h1 className="text-4xl font-extrabold text-gd-navy-dark tracking-tight">
            NH50 Pro Tracker
          </h1>
          <p className="mt-2 text-lg font-semibold text-gd-orange uppercase tracking-widest">
            50 ans New Holland · Gonnin Duris
          </p>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
            Guide de prise en main — Comment utiliser la plateforme pendant le sprint des 13 &amp; 14 octobre
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
            <Globe className="h-4 w-4 text-gd-navy" />
            <span className="font-mono text-sm font-semibold text-gd-navy-dark">{APP_URL}</span>
          </div>
        </div>

        {/* 1. Contexte */}
        <Section num="1" icon={Target} title="Le concept en 30 secondes">
          <p className="text-foreground leading-relaxed mb-3">
            <strong>NH50 Pro Tracker</strong> est la plateforme de pilotage commercial qui centralise
            le suivi des rendez-vous, des ventes et de l'activité atelier pour l'opération des 50 ans New Holland.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <Calendar className="h-6 w-6 text-gd-orange mb-2" />
              <p className="font-bold text-gd-navy-dark">Sprint RDV</p>
              <p className="text-sm text-muted-foreground">13 &amp; 14 octobre — prise de rendez-vous en cloisonné</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Wrench className="h-6 w-6 text-gd-orange mb-2" />
              <p className="font-bold text-gd-navy-dark">Atelier</p>
              <p className="text-sm text-muted-foreground">14 octobre — les chefs d'atelier rejoignent (hivernage)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Trophy className="h-6 w-6 text-gd-orange mb-2" />
              <p className="font-bold text-gd-navy-dark">Ventes</p>
              <p className="text-sm text-muted-foreground">15 octobre+ — déclarations et validation des ventes</p>
            </div>
          </div>
        </Section>

        {/* 2. Accès */}
        <Section num="2" icon={Globe} title="Accéder à la plateforme">
          <div className="rounded-xl border-2 border-gd-navy/20 bg-card p-5">
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gd-navy text-white text-xs font-bold shrink-0">1</span>
                <div>
                  <p className="font-semibold text-gd-navy-dark">Aller sur la plateforme</p>
                  <p className="text-sm text-muted-foreground">Ouvrir <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{APP_URL}</code> dans un navigateur (Chrome recommandé).</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gd-navy text-white text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="font-semibold text-gd-navy-dark">Se connecter</p>
                  <p className="text-sm text-muted-foreground">Utiliser l'email et le mot de passe fournis par la Direction. Possibilité de connexion Google.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gd-navy text-white text-xs font-bold shrink-0">3</span>
                <div>
                  <p className="font-semibold text-gd-navy-dark">Choisir son espace</p>
                  <p className="text-sm text-muted-foreground">Le menu de gauche s'adapte automatiquement à votre rôle (voir section 3).</p>
                </div>
              </li>
            </ol>
          </div>
        </Section>

        {/* 3. Les rôles */}
        <Section num="3" icon={Users} title="Les rôles et leurs espaces">
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-gd-orange" />
                <p className="font-bold text-gd-navy-dark">Collaborateur</p>
              </div>
              <p className="text-sm text-muted-foreground">Écran unique gamifié, sans défilement. Anneaux de progression, badges, classement. Actions directes : créer un RDV, déclarer une vente.</p>
              <p className="text-xs text-muted-foreground mt-1">→ Page d'accueil : <code className="bg-muted px-1.5 py-0.5 rounded">/espace-collaborateur</code></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-gd-orange" />
                <p className="font-bold text-gd-navy-dark">Commercial</p>
              </div>
              <p className="text-sm text-muted-foreground">Gère son portefeuille clients : priorités d'appétence, statuts, RDV, ventes. Voit ses badges et ses objectifs.</p>
              <p className="text-xs text-muted-foreground mt-1">→ Pages clés : <code className="bg-muted px-1.5 py-0.5 rounded">/portefeuille</code> · <code className="bg-muted px-1.5 py-0.5 rounded">/calendrier</code></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-gd-orange" />
                <p className="font-bold text-gd-navy-dark">Responsable commercial</p>
              </div>
              <p className="text-sm text-muted-foreground">Pilote son équipe : classement, taux de transformation, alertes. Gère les affectations clients.</p>
              <p className="text-xs text-muted-foreground mt-1">→ Page clé : <code className="bg-muted px-1.5 py-0.5 rounded">/equipe</code></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-gd-orange" />
                <p className="font-bold text-gd-navy-dark">Direction / Marketing</p>
              </div>
              <p className="text-sm text-muted-foreground">Accès complet : administration, paramètres, validation des ventes, gestion des utilisateurs, offres magasin, badges.</p>
              <p className="text-xs text-muted-foreground mt-1">→ Page clé : <code className="bg-muted px-1.5 py-0.5 rounded">/administration</code></p>
            </div>
          </div>
        </Section>

        {/* 4. Carte de navigation */}
        <Section num="4" icon={LayoutDashboard} title="Carte de navigation">
          <p className="text-sm text-muted-foreground mb-4">Toutes les pages accessibles selon le rôle. Les liens sont cliquables dans l'app (menu de gauche) ou accessibles directement via l'URL.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gd-orange mb-2">Pilotage</p>
              <LinkRow to="/tableau-de-bord" label="Tableau de bord" desc="KPIs, objectifs, compteurs temps réel" icon={LayoutDashboard} />
              <LinkRow to="/calendrier" label="Calendrier" desc="RDV groupés par jour" icon={Calendar} />
              <LinkRow to="/grand-ecran" label="Grand Écran" desc="Vue projection séminaire (voir section 6)" icon={Monitor} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gd-orange mb-2">Activité commerciale</p>
              <LinkRow to="/portefeuille" label="Mon portefeuille" desc="Clients à appeler, priorités d'appétence" icon={Briefcase} />
              <LinkRow to="/equipe" label="Mon équipe" desc="Classement, performance, alertes" icon={Users} />
              <LinkRow to="/magasin" label="Magasin" desc="Offres promotionnelles en cours" icon={Store} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gd-orange mb-2">Atelier</p>
              <LinkRow to="/atelier" label="Atelier" desc="Suivi des RDV hivernage" icon={Wrench} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gd-orange mb-2">Administration</p>
              <LinkRow to="/utilisateurs" label="Utilisateurs" desc="Inviter et gérer les comptes" icon={Users} />
              <LinkRow to="/administration" label="Administration" desc="Paramètres, ventes, affectations, badges" icon={Settings} />
            </div>
          </div>
        </Section>

        {/* 5. Actions clés */}
        <Section num="5" icon={CheckCircle2} title="Les 3 actions essentielles">
          <div className="space-y-3">
            <div className="flex items-start gap-4 rounded-xl border-2 border-gd-orange/30 bg-gd-orange/5 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-navy text-white shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-gd-navy-dark text-lg">1 · Prendre un RDV</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Depuis le portefeuille ou l'espace collaborateur, cliquer sur un client puis <strong>« Prendre un RDV »</strong>.
                  Choisir la date, l'heure, le type (commercial ou atelier hivernage). Le RDV apparaît instantanément sur le Grand Écran.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border-2 border-gd-orange/30 bg-gd-orange/5 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-navy text-white shrink-0">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-gd-navy-dark text-lg">2 · Déclarer une vente</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bouton <strong>« Déclarer une vente »</strong> : type de machine, type de vente, reprise éventuelle.
                  La vente est « À valider » jusqu'à validation par la Direction.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border-2 border-gd-orange/30 bg-gd-orange/5 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-navy text-white shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-gd-navy-dark text-lg">3 · Mettre à jour le statut client</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sur la fiche client : « À contacter » → « RDV obtenu » → « Devis en cours » → « Vente conclue » (ou « Refus »).
                  Les statuts alimentent automatiquement les compteurs et le classement.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* 6. Grand Écran */}
        <Section num="6" icon={Monitor} title="Le Grand Écran — pour la projection en séminaire">
          <div className="rounded-xl border-2 border-gd-navy bg-gd-navy-dark text-white p-6 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Monitor className="h-8 w-8 text-gd-orange" />
              <div>
                <p className="text-xl font-extrabold">Page Grand Écran</p>
                <p className="text-sm text-white/60">À projeter pendant le séminaire — affichage plein écran recommandé</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2">
              <Globe className="h-4 w-4 text-gd-orange" />
              <code className="text-sm font-mono text-gd-orange">{APP_URL}/grand-ecran</code>
            </div>
          </div>

          <p className="font-semibold text-gd-navy-dark mb-3">La page affiche 3 phases automatiquement :</p>
          <div className="space-y-2 mb-5">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Clock className="h-5 w-5 text-gd-navy shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gd-navy-dark">Avant le 13 octobre — Compte à rebours</p>
                <p className="text-sm text-muted-foreground">Décompte géant vers le sprint + objectif RDV affiché.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Zap className="h-5 w-5 text-gd-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gd-navy-dark">13 &amp; 14 octobre — Sprint RDV en cours</p>
                <p className="text-sm text-muted-foreground">Anneau de progression, classement live des commerciaux, feed temps réel, confettis à chaque RDV, indicateur Jour 1 / Jour 2 (Atelier le 14).</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Trophy className="h-5 w-5 text-gd-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gd-navy-dark">15 octobre+ — Sprint Ventes</p>
                <p className="text-sm text-muted-foreground">Basculage automatique vers le classement des ventes validées.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-purple-400/40 bg-purple-50 p-5">
            <p className="font-bold text-gd-navy-dark mb-2 flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" /> Mode démo — pour la présenter avant le 13 octobre
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Pour montrer la page <strong>avant le sprint</strong>, ajouter <code className="bg-white px-1.5 py-0.5 rounded text-xs">?demo=...</code> à l'URL.
              L'horloge simule le jour choisi et défile en temps réel. Un sélecteur flottant en bas à gauche permet de basculer.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-purple-600 shrink-0" />
                <span className="text-sm font-semibold text-gd-navy-dark">Jour 1 (13 oct) :</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{APP_URL}/grand-ecran?demo=jour1</code>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-purple-600 shrink-0" />
                <span className="text-sm font-semibold text-gd-navy-dark">Jour 2 / Atelier (14 oct) :</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{APP_URL}/grand-ecran?demo=jour2</code>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-purple-600 shrink-0" />
                <span className="text-sm font-semibold text-gd-navy-dark">Phase ventes :</span>
                <code className="text-xs bg-white px-2 py-1 rounded">{APP_URL}/grand-ecran?demo=ventes</code>
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Badges */}
        <Section num="7" icon={Award} title="Gamification & badges">
          <p className="text-sm text-muted-foreground mb-3">
            Les badges se débloquent automatiquement selon l'activité. Ils apparaissent sur l'espace collaborateur et le Grand Écran.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '🚀', name: 'Premier RDV', desc: '1er rendez-vous posé' },
              { icon: '⚡', name: 'Sprint 13-14', desc: 'Participation au sprint' },
              { icon: '🎯', name: 'Closeur', desc: 'Vente conclue' },
              { icon: '🧹', name: 'Portefeuille nettoyé', desc: 'Tous les clients traités' },
              { icon: '🔄', name: 'Chasseur de reprises', desc: 'Reprise obtenue' },
              { icon: '📋', name: 'Premier devis', desc: 'Devis émis' },
              { icon: '🔥', name: 'Série active', desc: 'Plusieurs RDV enchaînés' }
            ].map((b) => (
              <div key={b.name} className="rounded-xl border border-border bg-card p-3 text-center">
                <div className="text-3xl mb-1">{b.icon}</div>
                <p className="text-sm font-bold text-gd-navy-dark">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 8. Déroulé séminaire */}
        <Section num="8" icon={Calendar} title="Déroulé du séminaire — 13 & 14 octobre">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gd-navy text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Quand</th>
                  <th className="text-left px-4 py-3 font-semibold">Écran à projeter</th>
                  <th className="text-left px-4 py-3 font-semibold">Ce qu'on montre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gd-navy-dark">Avant le 13/10</td>
                  <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/grand-ecran</code></td>
                  <td className="px-4 py-3 text-muted-foreground">Compte à rebours + objectif — ambiance montante</td>
                </tr>
                <tr className="bg-gd-orange/5">
                  <td className="px-4 py-3 font-semibold text-gd-navy-dark">13/10 matin</td>
                  <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/grand-ecran</code></td>
                  <td className="px-4 py-3 text-muted-foreground">Lancement du sprint — les RDV arrivent en temps réel, confettis 🎉</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gd-navy-dark">13/10 toute la journée</td>
                  <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/grand-ecran</code></td>
                  <td className="px-4 py-3 text-muted-foreground">Classement live, progression vers l'objectif, feed des RDV commerciaux</td>
                </tr>
                <tr className="bg-gd-orange/5">
                  <td className="px-4 py-3 font-semibold text-gd-navy-dark">14/10</td>
                  <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/grand-ecran</code></td>
                  <td className="px-4 py-3 text-muted-foreground">Indicateur « Jour 2 · Atelier » — les RDV hivernage s'ajoutent au compteur</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gd-navy-dark">15/10+</td>
                  <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/grand-ecran</code></td>
                  <td className="px-4 py-3 text-muted-foreground">Bascule automatique : classement des ventes validées 🏆</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-gd-navy-dark">💡 Astuce animateur :</strong> pour présenter le Grand Écran <em>avant</em> le 13 octobre,
              utiliser les liens démo de la section 6. Le jour J, l'URL simple <code className="bg-card px-1.5 py-0.5 rounded text-xs">/grand-ecran</code> suffit —
              la page détecte la date automatiquement.
            </p>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t-2 border-gd-navy/20 text-center">
          <p className="text-sm text-muted-foreground">
            NH50 Pro Tracker · Gonnin Duris · 50 ans New Holland
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Document de briefing — à distribuer avant le séminaire des 13 &amp; 14 octobre 2026
          </p>
        </div>
      </div>
    </div>
  );
}