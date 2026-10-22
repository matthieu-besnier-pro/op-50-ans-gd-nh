import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  appBaseUrl
});

// « Voir en tant que », résolu côté SERVEUR.
//
// La simulation était jusqu'ici un filtrage du navigateur : chaque page
// retriait les données reçues. Le serveur, lui, répondait toujours à la
// Direction — c'est-à-dire tout. Résultat, la fidélité dépendait de chaque
// page, et aucune ne pouvait montrer ce qu'un compte voit vraiment.
//
// Le compte simulé accompagne désormais chaque appel de fonction. Le serveur
// calcule le périmètre de CE compte, et toutes les pages suivent sans rien
// avoir à réimplémenter.
//
// Deux garde-fous, côté serveur : seul un administrateur peut demander un
// autre compte, et le périmètre obtenu est celui du compte visé — toujours
// plus étroit que le sien. La simulation ne peut donc rien ouvrir.
let compteSimule = null;

export const definirCompteSimule = (id) => { compteSimule = id || null; };
export const compteSimuleActuel = () => compteSimule;

const invoquer = base44.functions.invoke.bind(base44.functions);
base44.functions.invoke = (nom, corps, ...reste) => invoquer(
  nom,
  compteSimule ? { ...(corps || {}), compte_id: compteSimule } : corps,
  ...reste
);
