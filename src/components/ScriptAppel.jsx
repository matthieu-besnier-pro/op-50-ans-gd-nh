import React, { useState } from 'react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import { Phone, MessageCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

const SECTIONS = [
  {
    id: 'accroche',
    title: "Accroche",
    icon: Phone,
    content: [
      "« Bonjour, [Nom] de la concession Gonnin Duris. Je vous appelle dans le cadre des 50 ans du partenariat New Holland. »",
      "Rappeler le lien historique avec la marque et l'opération anniversaire en cours.",
      "Proposer un échange court : visite du parc, devis de renouvellement, ou RDV atelier hivernage."
    ]
  },
  {
    id: 'qualification',
    title: "Questions de qualification",
    icon: HelpCircle,
    content: [
      "« Avez-vous des machines qui approchent de leur renouvellement ? »",
      "« Quand envisagez-vous votre prochain investissement ? »",
      "« Êtes-vous satisfait de votre matériel actuel ? »",
      "« Avez-vous prévu l'hivernage de votre parc ? »",
      "« Souhaitez-vous profiter d'une offre magasin sur la période ? »"
    ]
  },
  {
    id: 'objections',
    title: "Réponses aux objections courantes",
    icon: MessageCircle,
    content: [
      "« Pas le besoin maintenant » → évoquer les délais de livraison et l'anticipation.",
      "« Trop cher / budget » → présenter les offres 50 ans et le financement.",
      "« Je suis chez un concurrent » → mettre en avant le SAV local et la proximité.",
      "« Je vais réfléchir » → proposer un RDV atelier hivernage sans engagement.",
      "« Rappelez-moi plus tard » → fixer une date de rappel précise."
    ]
  },
  {
    id: 'cloture',
    title: "Clôture",
    icon: CheckCircle2,
    content: [
      "Récapituler la décision (RDV, devis, offre magasin).",
      "Confirmer la date et l'heure par écrit si possible.",
      "Remercier et rappeler le numéro direct de la concession."
    ]
  }
];

export default function ScriptAppel() {
  return (
    <Accordion type="single" collapsible className="rounded-xl border border-border bg-card">
      <AccordionItem value="script" className="border-0">
        <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
          <span className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gd-orange" />
            Script d'appel
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="rounded-lg bg-muted/50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gd-navy">
                    <Icon className="h-4 w-4 text-gd-orange" />
                    {s.title}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {s.content.map((line, i) => (
                      <li key={i} className="text-sm text-muted-foreground leading-relaxed pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-2 before:h-1 before:w-1 before:rounded-full before:bg-gd-blue-grey">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}