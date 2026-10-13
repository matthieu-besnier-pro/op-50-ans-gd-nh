import { Briefcase, PhoneCall, CalendarPlus, ShoppingBag } from 'lucide-react';

/**
 * Les 4 gestes du quotidien, racontés du point de vue du commercial.
 * Source unique partagée par la vue Présentation (écran, ~5 min) et le
 * Mémo animateur (une page, imprimable).
 *
 * Parti pris : on montre le geste et ce que ça change POUR LUI, pas les compteurs.
 */
export const GESTES = [
  {
    id: 'clients',
    num: '01',
    icon: Briefcase,
    geste: 'Mes clients',
    titre: 'Vos cibles sont déjà en tête de liste',
    accroche: 'La liste que vous avez demandée. Vos clients prioritaires remontent, avec une étoile.',
    points: [
      'Votre ciblage est repris tel quel, décision par décision',
      'Le filtre « Mes cibles » n\'affiche que les vôtres',
      'Le parc du client se lit d\'un coup d\'œil',
      'Un filtre dédié pour l\'agriculture de précision : tracteurs 2014-2020, CX 5/6, clients Trimble'
    ],
    ecran: '/portefeuille',
    animateur: {
      dire: "Votre liste, c'est la vôtre. Les clients que vous avez surlignés dans votre fichier sont là, en haut, avec une étoile.",
      montrer: "Ouvrez « Mes clients » et cliquez sur « Mes cibles prioritaires ».",
      reflexe: "Commencez par les cibles. Pour l'agri. précision, filtrez par origine : l'accroche n'est pas la même selon qu'on vient du parc tracteurs, des CX ou de Trimble."
    }
  },
  {
    id: 'appeler',
    num: '02',
    icon: PhoneCall,
    geste: 'Appeler',
    titre: 'Vous enchaînez, sans jamais perdre le fil',
    accroche: 'Le téléphone et le statut sont sur la ligne. Un clic, et vous passez au suivant.',
    points: [
      'L\'appel se lance depuis la ligne du client',
      'À contacter, Injoignable, À rappeler : un clic dans la liste',
      '« À rappeler » vous demande la date, puis on repart'
    ],
    ecran: '/portefeuille',
    animateur: {
      dire: "Vous appelez, ça ne répond pas, vous cliquez « Injoignable » et vous passez au suivant. Jamais besoin de rouvrir une fiche.",
      montrer: "Changez un statut directement dans la liste, puis « À rappeler » pour montrer la date demandée.",
      reflexe: "Faites-le faire par un commercial devant l'écran : c'est le geste qui fait gagner l'opération."
    }
  },
  {
    id: 'rdv',
    num: '03',
    icon: CalendarPlus,
    geste: 'Le RDV',
    titre: 'Un rendez-vous en trois clics',
    accroche: 'Le client, le type, le créneau. C\'est posé, et c\'est dans votre calendrier.',
    points: [
      'Trois types : Matériel, Atelier, Agriculture de précision',
      'Une grille de créneaux, pas un formulaire',
      'Il apparaît aussitôt dans votre calendrier',
      'Chaque type est suivi séparément : on sait ce que pèse chaque métier'
    ],
    ecran: '/calendrier',
    animateur: {
      dire: "Un rendez-vous, c'est trois clics : le client, le type, le créneau.",
      montrer: "Lancez « Ajout RDV » depuis la liste et allez jusqu'au créneau, puis basculez sur le calendrier.",
      reflexe: "Insistez sur les trois types — Matériel, Atelier, Agri. précision : ce ne sont pas les mêmes métiers, et ils sont comptés séparément."
    }
  },
  {
    id: 'vente',
    num: '04',
    icon: ShoppingBag,
    geste: 'Vendre',
    titre: 'Votre vente part sur WhatsApp',
    accroche: 'Comme vous le faites déjà. Aucune double saisie.',
    points: [
      'Vous annoncez sur le groupe, comme d\'habitude',
      'La vente est rattachée au bon client et au bon vendeur',
      'Un badge tombe : le Grand Écran l\'affiche'
    ],
    ecran: '/grand-ecran',
    animateur: {
      dire: "Vous ne saisirez jamais deux fois une vente. Vous l'annoncez sur le groupe WhatsApp comme aujourd'hui, l'outil la récupère.",
      montrer: "Le message type, puis la vente reprise dans l'outil, et le Grand Écran qui affiche le badge.",
      reflexe: "C'est l'argument qui lève la dernière résistance : « vous ne me rajoutez pas de travail »."
    }
  }
];

export default GESTES;