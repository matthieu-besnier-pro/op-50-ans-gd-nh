import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDemoPersona } from '@/lib/useDemoPersona';

/**
 * Chiffres EXACTS de l'opération (comptages calculés côté serveur, jamais tronqués
 * par les limites de chargement des listes).
 * La portée suit le persona de démo « Voir en tant que » quand il est actif.
 * Retourne null tant que les chiffres ne sont pas chargés.
 */
export function useOperationStats() {
  const persona = useDemoPersona();
  const [stats, setStats] = useState(null);
  const secteurs = (persona.secteurs || []).join(',');

  useEffect(() => {
    let actif = true;
    const payload = persona.mode
      ? { scope: { commercial_ids: persona.ids || [], secteurs: persona.secteurs || [] } }
      : {};
    base44.functions.invoke('statistiques_operation', payload)
      .then((res) => { if (actif) setStats(res?.data || null); })
      .catch(() => { if (actif) setStats(null); });
    return () => { actif = false; };
  }, [persona.mode, (persona.ids || []).join(','), secteurs]);

  return stats;
}

export default useOperationStats;