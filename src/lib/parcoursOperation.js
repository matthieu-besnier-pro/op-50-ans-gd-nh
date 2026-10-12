import {
  UserPlus, Zap, Briefcase, Lightbulb, PhoneCall, CalendarPlus,
  ShoppingBag, Trophy, LayoutDashboard
} from 'lucide-react';

/**
 * Le parcours de l'opération, de l'inscription du commercial jusqu'à la vente.
 * Source unique partagée par la vue Présentation (écran) et la vue Animateur
 * (script imprimable) : les deux racontent exactement la même histoire.
 *
 * Parti pris : on montre le geste et l'expérience, pas les compteurs.
 */
export const PARCOURS = [
  {
    id: 'inscription',
    icon: UserPlus,
    etape: 'Inscription',
    titre: 'Il entre en 30 secondes',
    accroche: 'Un identifiant, un mot de passe. C\'est tout.',
    points: [
      'Pas d\'email à saisir, pas de lien à attendre',
      'Les comptes sont préparés à l\'avance par la Direction',
      'Aux couleurs de l\'opération : il est tout de suite chez lui'
    ],
    ecran: '/login',
    animateur: {
      dire: "Le 13 au matin, personne ne perd deux heures à créer des comptes. Le commercial arrive, il tape son identifiant et son mot de passe, il est dedans.",
      montrer: "Affichez l'écran de connexion. Insistez sur l'absence d'email — c'est ce qui débloque le démarrage le jour J.",
      ecueil: "Si quelqu'un demande « et si j'oublie mon mot de passe ? » : la Direction le réinitialise depuis Administration, en direct."
    }
  },
  {
    id: 'espace',
    icon: Zap,
    etape: 'Mon espace',
    titre: 'Il voit sa mission, pas un tableau de bord',
    accroche: 'Une page qui répond à une seule question : je fais quoi, là, maintenant ?',
    points: [
      'Ses priorités du jour, mises en avant',
      'Ses badges déjà décrochés',
      'Aucun menu inutile : quatre écrans, pas plus'
    ],
    ecran: '/mon-espace',
    animateur: {
      dire: "On a volontairement dépouillé l'espace du commercial. Il n'a pas besoin de piloter l'entreprise : il a besoin de savoir qui appeler maintenant.",
      montrer: "Montrez la barre de gauche réduite : Mon espace, Tableau de bord, Calendrier, Mes clients.",
      ecueil: "Si un manager s'étonne de ne pas voir le Magasin ou le Grand Écran chez le commercial : c'est voulu, ça lui ferait perdre le fil."
    }
  },
  {
    id: 'clients',
    icon: Briefcase,
    etape: 'Mes clients',
    titre: 'Ses clients, ses cibles en tête de liste',
    accroche: 'Les clients qu\'il a lui-même choisis remontent toujours en premier.',
    points: [
      'Une étoile marque ses cibles prioritaires — son propre ciblage',
      'Les pictogrammes montrent le parc du client d\'un coup d\'œil',
      'Un filtre « Mes cibles » pour ne garder qu\'elles'
    ],
    ecran: '/portefeuille',
    animateur: {
      dire: "Chaque commercial a surligné dans son fichier les clients qu'il voulait travailler. On a repris ce ciblage tel quel : ses choix remontent en haut de sa liste, avec une étoile.",
      montrer: "Cliquez sur le filtre « Mes cibles prioritaires ». Puis montrez les pictogrammes de parc sur une ligne.",
      ecueil: "Point à marteler : ce n'est pas l'outil qui décide à sa place. C'est son ciblage à lui, respecté."
    }
  },
  {
    id: 'preparer',
    icon: Lightbulb,
    etape: 'Préparer',
    titre: 'Il sait quoi dire avant de décrocher',
    accroche: 'La fiche client prépare l\'appel à sa place.',
    points: [
      'Le parc machine du client, illustré par catégorie',
      'L\'historique : derniers échanges, RDV, ventes',
      'Un coach qui suggère l\'angle d\'attaque et le script'
    ],
    ecran: '/portefeuille',
    animateur: {
      dire: "Avant, préparer un appel voulait dire ouvrir trois fichiers. Là, tout est sur une page : ce qu'il a dans sa cour, ce qu'on lui a déjà dit, et par quoi commencer.",
      montrer: "Ouvrez une fiche client. Déroulez le parc matériel, puis le coach commercial.",
      ecueil: "Ne vous perdez pas dans la fiche : une minute suffit, l'important c'est qu'ils voient que tout est réuni."
    }
  },
  {
    id: 'appeler',
    icon: PhoneCall,
    etape: 'Appeler',
    titre: 'Il qualifie sans quitter sa liste',
    accroche: 'Le statut se change d\'un clic, directement dans le listing.',
    points: [
      'À contacter, Injoignable, À rappeler… en un geste',
      'Une date de rappel ou un motif de refus demandé quand il le faut',
      'Il enchaîne les appels sans jamais perdre sa place'
    ],
    ecran: '/portefeuille',
    animateur: {
      dire: "Le nerf de la guerre : l'enchaînement. Il appelle, ça ne répond pas, il clique « Injoignable », il passe au suivant. Jamais il ne rouvre une fiche pour ça.",
      montrer: "Depuis la liste, cliquez sur un badge de statut et changez-le. Puis faites « À rappeler » pour montrer la demande de date.",
      ecueil: "C'est LE moment qui fait gagner du temps sur deux semaines. Prenez trente secondes de plus dessus."
    }
  },
  {
    id: 'rdv',
    icon: CalendarPlus,
    etape: 'Le RDV',
    titre: 'Le rendez-vous se pose en trois clics',
    accroche: 'Le client, le type de rendez-vous, le créneau. Terminé.',
    points: [
      'RDV Matériel ou RDV Atelier : les deux sont suivis séparément',
      'Une grille de créneaux, pas un formulaire',
      'Le rendez-vous atterrit dans son calendrier et dans celui de son manager'
    ],
    ecran: '/calendrier',
    animateur: {
      dire: "On a transformé la prise de rendez-vous en trois gestes. Et on distingue bien le rendez-vous matériel du rendez-vous atelier — ce ne sont pas les mêmes métiers.",
      montrer: "Lancez « Ajout RDV » depuis la liste clients et allez jusqu'au créneau.",
      ecueil: "Faites-le en direct, sans filet : c'est l'écran qui déclenche le plus de réactions."
    }
  },
  {
    id: 'vente',
    icon: ShoppingBag,
    etape: 'La vente',
    titre: 'Il annonce sa vente là où il le fait déjà',
    accroche: 'Un message sur le groupe WhatsApp. L\'outil fait le reste.',
    points: [
      'Aucune double saisie demandée au commercial',
      'La vente est reconnue, rattachée au bon client et au bon vendeur',
      'Elle remonte aussitôt dans le suivi de l\'opération'
    ],
    ecran: '/magasin',
    animateur: {
      dire: "On ne demandera jamais à un commercial de saisir deux fois la même vente. Il l'annonce sur le groupe WhatsApp comme il le fait déjà, et l'outil la récupère.",
      montrer: "Montrez un message type, puis la vente reprise dans l'outil.",
      ecueil: "C'est l'argument qui lève la dernière résistance : « vous ne me rajoutez pas de travail »."
    }
  },
  {
    id: 'reconnaissance',
    icon: Trophy,
    etape: 'La reconnaissance',
    titre: 'Sa réussite se voit tout de suite',
    accroche: 'Un badge tombe, le hall s\'allume.',
    points: [
      'Des badges décrochés au fil des gestes, jamais punitifs',
      'Le Grand Écran affiche qui vient de décrocher quoi',
      'La reconnaissance va au commercial de la fiche, jamais à qui a saisi'
    ],
    ecran: '/grand-ecran',
    animateur: {
      dire: "Toute la journée, le Grand Écran tourne dans le hall. Quand quelqu'un décroche un badge, ça s'affiche avec son nom. C'est ça qui crée l'ambiance.",
      montrer: "Basculez en Grand Écran, laissez-le tourner quelques secondes.",
      ecueil: "Précisez bien : le mérite revient au commercial attribué au client, même si c'est un autre qui a enregistré."
    }
  },
  {
    id: 'pilotage',
    icon: LayoutDashboard,
    etape: 'Le pilotage',
    titre: 'Chacun voit ce qui le concerne',
    accroche: 'Le commercial ses clients, le manager son équipe, la direction l\'ensemble.',
    points: [
      'Le responsable retrouve ses vendeurs et leur avancement',
      'La direction peut regarder par manager ou par commercial',
      'Rendez-vous matériel et atelier restent toujours distingués'
    ],
    ecran: '/tableau-de-bord',
    animateur: {
      dire: "Même outil, trois lectures. Le commercial voit ses clients. Le responsable voit son équipe. La direction bascule d'un manager à l'autre pour comprendre où ça accroche.",
      montrer: "Utilisez « Voir en tant que » pour passer de la direction à un manager, puis à un commercial.",
      ecueil: "Terminez là-dessus : c'est ce qui rassure la direction sur le pilotage de l'opération."
    }
  }
];

export default PARCOURS;
