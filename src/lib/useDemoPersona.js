import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

/**
 * Hook central pour la démo "Voir en tant que".
 * - Si viewAsCommercial est défini (structure_commerciale ID), on filtre par ce commercial.
 * - Si viewAsManager est défini (nom du manager), on filtre par l'équipe de ce manager.
 * - Sinon, pas de filtre (vue admin globale).
 *
 * Retourne:
 *  - personaMode: 'commercial' | 'manager' | null
 *  - personaLabel: nom affichable (ex: "Jean Dupont" ou "Équipe de Marie Martin")
 *  - personaIds: tableau d'IDs structure_commerciale à utiliser pour filtrer
 *  - clientFilter: objet filtre pour base44.entities.client.filter()
 *  - matchClient(c): fonction pour vérifier si un client appartient au persona
 *  - matchCommercialId(id): fonction pour vérifier si un commercial_id correspond
 */
export function useDemoPersona() {
  const { viewAsCommercial, viewAsManager, viewAsRole } = useAuth();
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.structure_commerciale.list('-nom_commercial', 200)
      .then((rows) => { setStructure(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const persona = useMemo(() => {
    // Commercial spécifique
    if (viewAsRole === 'commercial' && viewAsCommercial) {
      const record = structure.find((s) => s.id === viewAsCommercial);
      return {
        mode: 'commercial',
        label: record?.nom_commercial || 'Commercial',
        ids: [viewAsCommercial],
        clientFilter: { commerciaux_assignes: viewAsCommercial },
        matchClient: (c) => (c.commerciaux_assignes || []).includes(viewAsCommercial),
        matchCommercialId: (id) => id === viewAsCommercial,
      };
    }
    // Manager spécifique
    if (viewAsRole === 'responsable' && viewAsManager) {
      const teamIds = structure
        .filter((s) => s.manager === viewAsManager)
        .map((s) => s.id);
      return {
        mode: 'manager',
        label: `Équipe de ${viewAsManager}`,
        ids: teamIds,
        clientFilter: null, // pas de filtre direct possible (multi-IDs), on filtre côté client
        matchClient: (c) => (c.commerciaux_assignes || []).some((id) => teamIds.includes(id)),
        matchCommercialId: (id) => teamIds.includes(id),
      };
    }
    return {
      mode: null,
      label: null,
      ids: [],
      clientFilter: null,
      matchClient: () => true,
      matchCommercialId: () => true,
    };
  }, [viewAsRole, viewAsCommercial, viewAsManager, structure]);

  return { ...persona, loading, structure };
}