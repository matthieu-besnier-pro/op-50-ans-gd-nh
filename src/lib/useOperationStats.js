import { useEffect, useState } from 'react';
import { useDemoPersona } from '@/lib/useDemoPersona';
import { fetchOperationStats } from '@/lib/operationStats';

/**
 * Chiffres EXACTS de l'opération (comptages calculés côté serveur, jamais tronqués
 * par les limites de chargement des listes).
 * La portée suit le persona de démo « Voir en tant que » quand il est actif.
 * L'appel est mutualisé et mis en cache (voir operationStats.js) : plusieurs pages
 * ouvertes dans la même session ne relancent pas le calcul.
 * Retourne null tant que les chiffres ne sont pas chargés.
 */
export function useOperationStats() {
  const persona = useDemoPersona();
  const [stats, setStats] = useState(null);
  const secteurs = (persona.secteurs || []).join(',');

  useEffect(() => {
    let actif = true;
    fetchOperationStats(
      persona.mode ? { commercial_ids: persona.ids || [], secteurs: persona.secteurs || [] } : null
    ).then((data) => { if (actif) setStats(data); });
    return () => { actif = false; };
  }, [persona.mode, (persona.ids || []).join(','), secteurs]);

  return stats;
}

export default useOperationStats;