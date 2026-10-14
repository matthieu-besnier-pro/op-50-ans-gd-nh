import { base44 } from '@/api/base44Client';

/**
 * Contacts pris par les ateliers (fonction serveur statistiques_atelier).
 *
 * Le Grand Écran s'en sert pour sa moitié « ateliers ». La fonction ne lit que les
 * clients ciblés par l'atelier, là où statistiques_operation balaie toute
 * l'opération : la charge reste négligeable même sur un écran qui tourne en
 * continu. Un appel raté n'est pas retenté avant un délai (sinon un écran qui se
 * rafraîchit toutes les 15 s entretient lui-même la limite de débit atteinte).
 *
 * @returns {Promise<object|null>} les comptages atelier, ou null en cas d'échec.
 */
const TTL = 60 * 1000;
const REPOS = 45 * 1000; // délai avant de rappeler après un échec

let cache = null;
let cacheAt = 0;
let echecAt = 0;
let enCours = null;

export function fetchAtelierStats() {
  if (cache && Date.now() - cacheAt < TTL) return Promise.resolve(cache);
  if (echecAt && Date.now() - echecAt < REPOS) return Promise.resolve(null);
  if (enCours) return enCours;

  enCours = base44.functions.invoke('statistiques_atelier', {})
    .then((res) => {
      const data = res?.data?.atelier || null;
      if (data) {
        cache = data;
        cacheAt = Date.now();
        echecAt = 0;
      } else {
        echecAt = Date.now();
      }
      return data;
    })
    .catch(() => {
      echecAt = Date.now();
      return null;
    })
    .finally(() => { enCours = null; });

  return enCours;
}

/** Après un contact atelier posé ou annulé : la prochaine lecture repart du serveur. */
export function invaliderAtelierStats() {
  cache = null;
  cacheAt = 0;
}

export default fetchAtelierStats;