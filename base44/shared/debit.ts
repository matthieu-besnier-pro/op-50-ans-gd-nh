// Limite de débit de la plateforme.
//
// Quand plusieurs dizaines de postes interrogent l'API en même temps — ce qui
// est la situation normale pendant l'opération — une lecture peut être refusée.
// Sans reprise, la fonction appelante échoue, et l'écran affiche une liste vide
// comme s'il n'y avait pas de données : le pire des deux mondes.
//
// On patiente et on réessaie. Une lecture qui arrive une seconde plus tard vaut
// infiniment mieux qu'un portefeuille qui paraît s'être évaporé.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const estLimiteDebit = (e) =>
  /rate limit|too many requests|429/i.test(String(e?.message || e));

export async function avecReprise(fn, essais = 4) {
  let attente = 400;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!estLimiteDebit(e) || i >= essais) throw e;
      await sleep(attente);
      attente = Math.min(attente * 2, 5000);
    }
  }
}

export default avecReprise;
