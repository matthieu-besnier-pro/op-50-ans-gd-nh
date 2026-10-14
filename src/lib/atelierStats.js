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
 * En cas d'échec, on rend les DERNIERS CHIFFRES CONNUS plutôt que rien : sur un
 * écran projeté, des compteurs qui retombent à zéro puis remontent au cycle
 * suivant font croire à des rendez-vous perdus. Mieux vaut un chiffre d'il y a
 * une minute qu'un chiffre faux.
 *
 * @returns {Promise<object|null>} les comptages atelier, ou les derniers connus.
 */
const TTL = 60 * 1000;
const REPOS = 45 * 1000; // délai avant de rappeler après un échec

let cache = null;
let cacheAt = 0;
let echecAt = 0;
let enCours = null;

export function fetchAtelierStats() {
  if (cache && Date.now() - cacheAt < TTL) return Promise.resolve(cache);
  if (echecAt && Date.now() - echecAt < REPOS) return Promise.resolve(cache);
  if (enCours) return enCours;

  enCours = base44.functions.invoke('statistiques_atelier', {})
    .then((res) => {
      // Le serveur signale un comptage incomplet : on ne l'affiche pas.
      const data = res?.data?.indisponible ? null : (res?.data?.atelier || null);
      if (data) {
        cache = data;
        cacheAt = Date.now();
        echecAt = 0;
        return data;
      }
      echecAt = Date.now();
      return cache;
    })
    .catch(() => {
      echecAt = Date.now();
      return cache;
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