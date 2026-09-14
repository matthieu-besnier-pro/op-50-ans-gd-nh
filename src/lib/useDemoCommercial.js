import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';

/**
 * Hook pour la démo: quand un commercial est sélectionné via "Voir en tant que",
 * fournit un filtre pour les requêtes d'entités.
 * - Si viewAsCommercial est null (admin normal), pas de filtre.
 * - Si viewAsCommercial est défini, filtre les clients/rdv/ventes par ce commercial.
 */
export function useDemoCommercial() {
  const { viewAsCommercial, setViewAsCommercial, user } = useAuth();
  const [commercialInfo, setCommercialInfo] = useState(null);

  useEffect(() => {
    if (!viewAsCommercial) {
      setCommercialInfo(null);
      return;
    }
    base44.entities.structure_commerciale.get(viewAsCommercial)
      .then(setCommercialInfo)
      .catch(() => setCommercialInfo(null));
  }, [viewAsCommercial]);

  // Filter object for clients
  const clientFilter = viewAsCommercial ? { commerciaux_assignes: viewAsCommercial } : null;

  return {
    viewAsCommercial,
    setViewAsCommercial,
    commercialInfo,
    clientFilter,
    isActive: !!viewAsCommercial
  };
}