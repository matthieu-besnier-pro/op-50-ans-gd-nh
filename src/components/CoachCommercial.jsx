import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Flame, Tractor, Wrench, Euro, Calendar, PhoneCall,
  TrendingUp, AlertCircle, Lightbulb, Target, Clock, Award
} from 'lucide-react';

/**
 * Rule-based sales coach.
 * Analyzes client data and generates actionable, motivating advice cards.
 * No LLM needed — works immediately.
 */
function generateInsights(client, materiels, rdvs, ventes) {
  const insights = [];
  const score = client.score_appetence || 0;
  const niveau = client.niveau_appetence;
  const statut = client.statut || 'À contacter';
  const lastContact = client.date_dernier_contact;
  const terminalStatuts = ['Vente conclue', 'Refus', 'Contacté sans suite'];

  // 1. Appetence + never contacted = GO NOW
  if (niveau === 'Fort' && (!lastContact || statut === 'À contacter')) {
    insights.push({
      priority: 'high',
      icon: Flame,
      title: 'Appétence FORTE — appelez en priorité',
      desc: `Score ${score}/100. Ce client est un potentiel élevé${!lastContact ? ' et n\'a jamais été contacté' : ''}. C\'est votre meilleure opportunité du jour.`,
      cta: 'Appeler maintenant'
    });
  }

  // 2. Never contacted
  if (!lastContact && statut === 'À contacter' && niveau !== 'Fort') {
    insights.push({
      priority: 'medium',
      icon: PhoneCall,
      title: 'Premier contact à faire',
      desc: 'Ce client n\'a encore jamais été appelé. Un simple appel de prise de température peut débloquer une opportunité.',
      cta: 'Premier appel'
    });
  }

  // 3. Old equipment → renewal
  const oldMateriels = materiels.filter(m => {
    if (!m.premiere_immat) return false;
    const age = (new Date() - new Date(m.premiere_immat)) / (365.25 * 86400000);
    return age >= 7;
  });
  if (oldMateriels.length > 0) {
    const oldest = oldMateriels.sort((a, b) => new Date(a.premiere_immat) - new Date(b.premiere_immat))[0];
    const age = Math.round((new Date() - new Date(oldest.premiere_immat)) / (365.25 * 86400000));
    const cat = oldest.categorie_2 || oldest.categorie_1 || oldest.marque || 'machine';
    insights.push({
      priority: 'high',
      icon: Tractor,
      title: `${cat} de ${age} ans — renouvellement probable`,
      desc: `Le parc inclut un matériel ancien (${oldest.marque || ''} ${oldest.modele || ''}, 1ère immat ${new Date(oldest.premiere_immat).getFullYear()}). C'est le moment idéal pour proposer un renouvellement.`,
      cta: 'Proposer un renouvellement'
    });
  }

  // 4. Upcoming renewal prediction (prochain_achat)
  const soonRenewals = materiels.filter(m => {
    if (!m.prochain_achat) return false;
    const months = (new Date(m.prochain_achat) - new Date()) / (30 * 86400000);
    return months >= -2 && months <= 12;
  });
  if (soonRenewals.length > 0) {
    const m = soonRenewals[0];
    insights.push({
      priority: 'high',
      icon: Target,
      title: 'Fenêtre de renouvellement détectée',
      desc: `Le système prédit un renouvellement prochain (${new Date(m.prochain_achat).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}). Anticipez l'offre avant un concurrent.`,
      cta: 'Préparer une offre'
    });
  }

  // 5. High CA client → loyalty
  const ca = client.ca_total_12m || 0;
  if (ca >= 20000) {
    insights.push({
      priority: 'medium',
      icon: Euro,
      title: `Client fidèle — ${ca.toLocaleString('fr-FR')} € de CA / 12 mois`,
      desc: `CA annuel élevé${client.panier_moyen ? `, panier moyen de ${client.panier_moyen.toLocaleString('fr-FR')} €` : ''}. Valuez la relation : proposez une offre magasin ou un RDV commercial de courtoisie.`,
      cta: 'Proposer une offre'
    });
  }

  // 6. Open workshop orders → atelier RDV
  const ot = client.nb_ot_ouverts || 0;
  if (ot >= 2) {
    insights.push({
      priority: 'medium',
      icon: Wrench,
      title: `${ot} OT ouverts — opportunité atelier`,
      desc: 'Ce client a plusieurs ordres de travail en cours. Proposez un RDV atelier hivernage pour fidéliser et détecter un besoin matériel.',
      cta: 'RDV atelier'
    });
  }

  // 7. À rappeler + date rappel reached
  if (statut === 'À rappeler' && client.date_rappel) {
    const rappel = new Date(client.date_rappel);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (rappel <= today) {
      insights.push({
        priority: 'high',
        icon: Clock,
        title: 'Date de rappel atteinte — rappelez aujourd\'hui',
        desc: `Vous deviez rappeler ce client le ${new Date(client.date_rappel).toLocaleDateString('fr-FR')}. Ne laissez pas l'opportunité refroidir.`,
        cta: 'Rappeler'
      });
    }
  }

  // 8. Injoignable plusieurs fois
  if (statut === 'Injoignable' && (client.nb_tentatives_contact || 0) >= 2) {
    insights.push({
      priority: 'medium',
      icon: AlertCircle,
      title: `${client.nb_tentatives_contact} tentatives sans réponse`,
      desc: 'Essayez en dehors des heures classiques (tôt le matin ou en soirée). Ou laissez un message clair avec un créneau de rappel proposé.',
      cta: 'Nouvelle tentative'
    });
  }

  // 9. Devis en cours → relance
  if (statut === 'Devis en cours') {
    insights.push({
      priority: 'high',
      icon: TrendingUp,
      title: 'Devis en cours — relancez',
      desc: `Un devis est en cours${client.montant_devis ? ` de ${client.montant_devis.toLocaleString('fr-FR')} €` : ''}. La clé : un suivi rapproché pour transformer en vente.`,
      cta: 'Relancer le devis'
    });
  }

  // 10. Offre magasin à proposer
  if (statut === 'Offre magasin à proposer') {
    insights.push({
      priority: 'high',
      icon: Euro,
      title: 'Offre magasin prête à proposer',
      desc: 'Ce client attend une proposition. Préparez l\'offre et planifiez la présentation.',
      cta: 'Présenter l\'offre'
    });
  }

  // 11. PAC beneficiary
  if (client.beneficiaire_pac_certain) {
    insights.push({
      priority: 'low',
      icon: Award,
      title: 'Bénéficiaire PAC certain',
      desc: 'Structure (CUMA/ETA) avec PAC confirmée. Capacité d\'investissement probable — argumentez sur le financement.',
      cta: null
    });
  }

  // 12. Already done — encouragement
  if (terminalStatuts.includes(statut)) {
    insights.push({
      priority: 'low',
      icon: Award,
      title: statut === 'Vente conclue' ? 'Vente conclue — bravo !' : 'Client traité',
      desc: statut === 'Vente conclue'
        ? 'Excellent travail. Pensez au suivi post-vente et à la satisfaction client.'
        : 'Ce client est dans un statut final. Concentrez-vous sur les autres opportunités de votre portefeuille.',
      cta: null
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => order[a.priority] - order[b.priority]);
  return insights;
}

function conversionProbability(client, materiels) {
  let prob = 20;
  const niveau = client.niveau_appetence;
  if (niveau === 'Fort') prob += 35;
  else if (niveau === 'Moyen') prob += 15;
  const score = client.score_appetence || 0;
  prob += Math.min(score * 0.15, 15);
  if (materiels.some(m => {
    if (!m.prochain_achat) return false;
    return (new Date(m.prochain_achat) - new Date()) / (30 * 86400000) <= 6;
  })) prob += 15;
  if ((client.ca_total_12m || 0) >= 20000) prob += 10;
  if (client.statut === 'Devis en cours') prob += 20;
  if (client.statut === 'Offre magasin à proposer') prob += 15;
  if (client.statut === 'RDV obtenu') prob += 10;
  if (['Vente conclue', 'Refus', 'Contacté sans suite'].includes(client.statut)) prob = client.statut === 'Vente conclue' ? 100 : 0;
  return Math.min(Math.round(prob), 100);
}

const PRIORITY_STYLES = {
  high: { card: 'border-emerald-300 bg-emerald-50', icon: 'bg-emerald-500 text-white', label: 'Priorité haute' },
  medium: { card: 'border-gd-orange/40 bg-gd-orange/5', icon: 'bg-gd-orange text-gd-navy-dark', label: 'À faire' },
  low: { card: 'border-border bg-card', icon: 'bg-muted text-muted-foreground', label: 'Info' }
};

export default function CoachCommercial({ client, materiels, rdvs, ventes }) {
  const insights = useMemo(() => generateInsights(client, materiels, rdvs, ventes), [client, materiels, rdvs, ventes]);
  const proba = useMemo(() => conversionProbability(client, materiels), [client, materiels]);

  const probaColor = proba >= 70 ? 'text-emerald-600' : proba >= 40 ? 'text-gd-orange' : 'text-muted-foreground';
  const probaLabel = proba >= 70 ? 'Très probable' : proba >= 40 ? 'Possible' : 'Incertain';
  const probaBar = proba >= 70 ? 'bg-emerald-500' : proba >= 40 ? 'bg-gd-orange' : 'bg-muted-foreground';

  return (
    <div className="rounded-xl border-2 border-gd-navy/20 bg-gradient-to-br from-card to-emerald-50/30 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gd-navy text-white">
          <Lightbulb className="h-5 w-5 text-gd-orange" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gd-navy-dark">Coach Commercial</h2>
          <p className="text-xs text-muted-foreground">Vos meilleures actions sur ce client</p>
        </div>
      </div>

      {/* Conversion probability gauge */}
      <div className="mb-4 rounded-lg bg-card border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Probabilité de conversion
          </span>
          <span className={cn('text-sm font-extrabold', probaColor)}>{proba}% · {probaLabel}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', probaBar)} style={{ width: `${proba}%` }} />
        </div>
      </div>

      {/* Insight cards */}
      <div className="space-y-2.5">
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">Aucune action prioritaire détectée.</p>
        ) : insights.slice(0, 5).map((ins, i) => {
          const style = PRIORITY_STYLES[ins.priority];
          const Icon = ins.icon;
          return (
            <div key={i} className={cn('rounded-lg border p-3', style.card)}>
              <div className="flex items-start gap-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', style.icon)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gd-navy-dark leading-tight mb-0.5">{ins.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ins.desc}</p>
                  {ins.cta && (
                    <p className="mt-1.5 text-xs font-bold text-gd-navy flex items-center gap-1">
                      → {ins.cta}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}