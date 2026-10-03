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
    // Commercial spécifique — on filtre par l'ID utilisateur lié (les affectations
    // et les RDV portent le user_id, pas l'ID de la fiche structure_commerciale).
    if (viewAsRole === 'commercial' && viewAsCommercial) {
      const record = structure.find((s) => s.id === viewAsCommercial);
      const uid = record?.user_id || viewAsCommercial;
      const nom = (record?.nom_commercial || '').trim();
      return {
        mode: 'commercial',
        label: nom || 'Commercial',
        ids: [uid],
        secteurs: nom ? [nom] : [],
        clientFilter: nom ? { secteur: nom } : { commerciaux_assignes: uid },
        matchClient: (c) => (nom && (c.secteur || '').trim() === nom) || (c.commerciaux_assignes || []).includes(uid),
        matchCommercialId: (id) => id === uid,
      };
    }
    // Manager spécifique — équipe résolue en IDs utilisateurs et en secteurs (noms)
    if (viewAsRole === 'responsable' && viewAsManager) {
      const teamRows = structure.filter((s) => s.manager === viewAsManager);
      const teamIds = teamRows.map((s) => s.user_id || s.id);
      const secteurs = teamRows.map((s) => (s.nom_commercial || '').trim()).filter(Boolean);
      return {
        mode: 'manager',
        label: `Équipe de ${viewAsManager}`,
        ids: teamIds,
        secteurs,
        clientFilter: secteurs.length > 0 ? { secteur: { $in: secteurs } } : null,
        matchClient: (c) => teamIds.includes(c.id) || secteurs.includes((c.secteur || '').trim()) || (c.commerciaux_assignes || []).some((id) => teamIds.includes(id)),
        matchCommercialId: (id) => teamIds.includes(id),
      };
    }
    return {
      mode: null,
      label: null,
      ids: [],
      secteurs: [],
      clientFilter: null,
      matchClient: () => true,
      matchCommercialId: () => true,
    };
  }, [viewAsRole, viewAsCommercial, viewAsManager, structure]);

  return { ...persona, loading, structure };
}