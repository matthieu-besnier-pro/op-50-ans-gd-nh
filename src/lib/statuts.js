import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Tonalités disponibles pour les badges de statut (reprises de la charte de l'opération).
export const TONALITES = [
  { value: 'neutre', label: 'Gris', badge: 'bg-slate-100 text-slate-700 border-slate-200', point: 'bg-slate-400' },
  { value: 'discret', label: 'Gris clair', badge: 'bg-slate-100 text-slate-500 border-slate-200', point: 'bg-slate-300' },
  { value: 'orange', label: 'Orange', badge: 'bg-orange-50 text-orange-700 border-orange-200', point: 'bg-orange-400' },
  { value: 'ambre', label: 'Ambre', badge: 'bg-amber-50 text-amber-700 border-amber-200', point: 'bg-amber-400' },
  { value: 'bleu', label: 'Bleu', badge: 'bg-blue-50 text-blue-700 border-blue-200', point: 'bg-blue-400' },
  { value: 'indigo', label: 'Indigo', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', point: 'bg-indigo-400' },
  { value: 'violet', label: 'Violet', badge: 'bg-violet-50 text-violet-700 border-violet-200', point: 'bg-violet-400' },
  { value: 'cyan', label: 'Cyan', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', point: 'bg-cyan-400' },
  { value: 'teal', label: 'Turquoise', badge: 'bg-teal-50 text-teal-700 border-teal-200', point: 'bg-teal-400' },
  { value: 'vert', label: 'Vert', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', point: 'bg-emerald-400' },
  { value: 'rouge', label: 'Rouge', badge: 'bg-red-50 text-red-700 border-red-200', point: 'bg-red-400' },
  { value: 'fuchsia', label: 'Fuchsia', badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', point: 'bg-fuchsia-400' }
];

export const tonaliteDe = (value) => TONALITES.find((t) => t.value === value) || TONALITES[0];

// Statuts de l'opération : ils servent de base tant que la Direction n'a rien
// personnalisé, et de repli si la configuration n'est pas encore chargée.
// `systeme: true` = statut posé ou lu par un automatisme : nom et suppression verrouillés.
export const STATUTS_DEFAUT = [
  { nom: 'À contacter', ordre: 1, tonalite: 'neutre', systeme: true, usage: 'Statut par défaut des clients importés ; alimente le compteur « clients à contacter ».' },
  { nom: 'Injoignable', ordre: 2, tonalite: 'orange', systeme: true, usage: 'Incrémente automatiquement le nombre de tentatives de contact.' },
  { nom: 'À rappeler', ordre: 3, tonalite: 'ambre', systeme: true, usage: 'Impose une date de rappel et alimente les relances du jour.' },
  { nom: 'Contacté sans suite', ordre: 4, tonalite: 'discret', systeme: true, usage: 'Clôt le suivi du client : la probabilité de vente retombe à 0.' },
  { nom: 'RDV Commercial obtenu', ordre: 5, tonalite: 'bleu', systeme: true, usage: "Coché automatiquement à la prise d'un rendez-vous commercial." },
  { nom: 'RDV Atelier obtenu', ordre: 6, tonalite: 'indigo', systeme: true, usage: "Coché automatiquement à la prise d'un rendez-vous atelier." },
  { nom: 'RDV Agri. précision obtenu', ordre: 7, tonalite: 'violet', systeme: true, usage: "Coché automatiquement à la prise d'un rendez-vous agriculture de précision." },
  // Suivi atelier : le rendez-vous ne se prend plus tout de suite, le référent pose
  // ce statut unique (voir src/lib/statutsAtelier.js).
  { nom: "Contacté par l'atelier OK pour un RDV", ordre: 8, tonalite: 'vert', systeme: true, usage: "Posé d'un clic par le chef d'atelier dans la liste SAV : c'est ce marquage qui compte les prises de contact atelier." },
  { nom: 'Offre magasin à proposer', ordre: 9, tonalite: 'cyan', systeme: true, usage: 'Compte les offres magasin (badge « offre magasin »).' },
  { nom: 'Offre SAV à proposer', ordre: 10, tonalite: 'fuchsia', systeme: false, usage: '' },
  { nom: 'Offre agri. précision à proposer', ordre: 11, tonalite: 'teal', systeme: false, usage: '' },
  { nom: 'Vente conclue', ordre: 12, tonalite: 'vert', systeme: true, usage: 'Compte les ventes et le taux de transformation.' },
  { nom: 'Refus', ordre: 13, tonalite: 'rouge', systeme: true, usage: 'Impose un motif de refus.' }
];

// Cache partagé : les badges affichent la bonne couleur sans recharger la configuration.
let cache = [];

export const statutsEnCache = () => cache;

export const couleurStatut = (nom) => {
  const conf = cache.find((s) => s.nom === nom) || STATUTS_DEFAUT.find((s) => s.nom === nom);
  return tonaliteDe(conf?.tonalite).badge;
};

// Liste des statuts configurés, triés par ordre d'affichage.
export function useStatuts() {
  const [statuts, setStatuts] = useState(cache.length ? cache : STATUTS_DEFAUT);
  useEffect(() => {
    let vivant = true;
    base44.entities.statut_client.list('ordre', 200)
      .then((res) => {
        const liste = Array.isArray(res) ? res : (res?.items || []);
        if (!liste.length) return;
        cache = liste;
        if (vivant) setStatuts(liste);
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, []);
  return statuts;
}