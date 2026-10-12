import { base44 } from '@/api/base44Client';

/**
 * Lectures mutualisées et mises en cache.
 *
 * Avant : chaque page rechargeait les mêmes listes à chaque montage
 * (rdv 1000, vente 1000, structure, paramètres, utilisateurs…). Changer
 * « Voir en tant que » ou revenir en arrière relançait tout — d'où les
 * temps d'attente.
 *
 * Ici : un seul appel par clé, partagé par toutes les pages, gardé quelques
 * secondes. Deux pages qui demandent la même chose en même temps se
 * partagent la même requête (déduplication des appels en vol).
 *
 * Après une écriture, appelez `invalider('rdv')` pour que la prochaine
 * lecture reparte du serveur.
 */

// Durées de vie : courtes pour l'activité, longues pour le référentiel.
const TTL = {
  rdv: 15000,
  vente: 15000,
  client: 15000,
  badge_obtenu: 15000,
  structure_commerciale: 300000,
  parametres_operation: 300000,
  User: 300000,
  badge: 300000,
  statut_client: 300000,
  base: 300000,
  offre_magasin: 60000
};
const TTL_DEFAUT = 30000;

const cache = new Map();   // clé → { at, data }
const enVol = new Map();   // clé → promesse en cours

const cle = (entite, tri, limite) => `${entite}|${tri}|${limite}`;

/**
 * Liste une entité, en réutilisant le résultat récent s'il existe.
 * Mêmes arguments que `base44.entities.X.list(tri, limite)`.
 */
export function listerPartage(entite, tri, limite) {
  const k = cle(entite, tri, limite);
  const duree = TTL[entite] ?? TTL_DEFAUT;

  const connu = cache.get(k);
  if (connu && Date.now() - connu.at < duree) return Promise.resolve(connu.data);
  if (enVol.has(k)) return enVol.get(k);

  const promesse = base44.entities[entite].list(tri, limite)
    .then((data) => {
      const liste = Array.isArray(data) ? data : [];
      cache.set(k, { at: Date.now(), data: liste });
      return liste;
    })
    .catch(() => {
      // Un échec ne doit pas être mémorisé : on réessaiera au prochain besoin.
      const precedent = cache.get(k);
      return precedent ? precedent.data : [];
    })
    .finally(() => enVol.delete(k));

  enVol.set(k, promesse);
  return promesse;
}

/** Oublie le cache d'une entité (après une écriture), ou tout si non précisé. */
export function invalider(entite) {
  if (!entite) { cache.clear(); return; }
  [...cache.keys()].forEach((k) => { if (k.startsWith(`${entite}|`)) cache.delete(k); });
}

export default listerPartage;
