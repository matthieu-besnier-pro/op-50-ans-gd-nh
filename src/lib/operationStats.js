import { base44 } from '@/api/base44Client';

/**
 * Comptages EXACTS de l'opération (fonction serveur statistiques_operation).
 *
 * Cette fonction parcourt l'intégralité des données : un appel coûte ~4 s. Plusieurs
 * pages et plusieurs rechargements automatiques l'appelaient en même temps, pour le
 * même résultat. On la mutualise donc : un seul appel par portée, partagé par toutes
 * les pages et mis en cache une minute (les données changent quelques fois par jour).
 *
 * @param {{commercial_ids?: string[], secteurs?: string[]}|null} scope
 *        Portée « voir en tant que » (Direction uniquement) ; null = toute l'opération.
 * @returns {Promise<object|null>} les statistiques, ou null en cas d'échec.
 */
const TTL = 60 * 1000;
const cache = new Map(); // clé → { at, data }
const enCours = new Map(); // clé → promesse en vol (évite les appels simultanés)

export function fetchOperationStats(scope) {
  const ids = scope?.commercial_ids || [];
  const secteurs = scope?.secteurs || [];
  const payload = ids.length > 0 || secteurs.length > 0
    ? { scope: { commercial_ids: ids, secteurs } }
    : {};
  const cle = JSON.stringify(payload);

  const connu = cache.get(cle);
  if (connu && Date.now() - connu.at < TTL) return Promise.resolve(connu.data);
  if (enCours.has(cle)) return enCours.get(cle);

  const promesse = base44.functions.invoke('statistiques_operation', payload)
    .then((res) => {
      const data = res?.data || null;
      if (data) cache.set(cle, { at: Date.now(), data });
      return data;
    })
    .catch(() => null)
    .finally(() => enCours.delete(cle));

  enCours.set(cle, promesse);
  return promesse;
}

/**
 * Oublie le cache : le prochain appel relit le serveur.
 *
 * À utiliser après une écriture qui doit se voir tout de suite — typiquement la
 * prise d'un rendez-vous projetée sur le Grand Écran, où une minute de cache
 * ferait tomber les confettis sur un compteur resté figé.
 */
export function invaliderStats() {
  cache.clear();
}

export default fetchOperationStats;