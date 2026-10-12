import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { normNom } from '@/lib/nomCle';

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
  const { viewAsCommercial, viewAsManager, viewAsReferent, viewAsRole } = useAuth();
  const [structure, setStructure] = useState([]);
  const [bases, setBases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.structure_commerciale.list('-nom_commercial', 200),
      base44.entities.base.list('-nom', 100)
    ])
      .then(([rows, sites]) => { setStructure(rows); setBases(sites); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const persona = useMemo(() => {
    // Commercial spécifique — on filtre sur le compte lié (assignations et RDV portent le user_id)
    // ET sur l'ID de la fiche, car un portefeuille partagé (doublon de secteur) garde
    // le nom du secteur d'origine et peut encore porter l'ID de la fiche.
    if (viewAsRole === 'commercial' && viewAsCommercial) {
      const record = structure.find((s) => s.id === viewAsCommercial);
      const uid = record?.user_id || viewAsCommercial;
      const nom = (record?.nom_commercial || '').trim();
      return {
        mode: 'commercial',
        label: nom || 'Commercial',
        ids: [uid],
        secteurs: nom ? [nom] : [],
        clientFilter: nom
          ? { $or: [{ commerciaux_assignes: uid }, { secteur: nom }] }
          : { commerciaux_assignes: uid },
        matchClient: (c) => (nom && (c.secteur || '').trim() === nom) || (c.commerciaux_assignes || []).includes(uid),
        matchCommercialId: (id) => id === uid,
      };
    }
    // Chef d'atelier / responsable SAV — les clients des commerciaux de ses sites
    // (tableau de répartition : base.commerciaux × base.chefs_atelier / responsables_sav).
    if ((viewAsRole === 'chef_atelier' || viewAsRole === 'responsable_sav') && viewAsReferent) {
      const champ = viewAsRole === 'chef_atelier' ? 'chefs_atelier' : 'responsables_sav';
      const mesSites = bases.filter((b) => (b[champ] || []).includes(viewAsReferent));
      const noms = [...new Set(mesSites.flatMap((b) => b.commerciaux || []))];
      const cles = new Set(noms.map(normNom));
      const mesFiches = structure.filter((f) => cles.has(normNom(f.nom_commercial)));
      const ids = [...new Set(mesFiches.flatMap((f) => [f.id, f.user_id]).filter(Boolean))];
      const secteurs = [...new Set(mesFiches.map((f) => (f.nom_commercial || '').trim()).filter(Boolean))];
      return {
        mode: 'atelier',
        label: viewAsReferent,
        sites: mesSites.map((b) => b.nom),
        ids,
        secteurs,
        clientFilter: ids.length
          ? { $or: [{ commerciaux_assignes: { $in: ids } }, { secteur: { $in: secteurs } }] }
          : null,
        matchClient: (c) =>
          (c.commerciaux_assignes || []).some((i) => ids.includes(i)) ||
          secteurs.some((n) => normNom(n) === normNom(c.secteur)),
        matchCommercialId: (id) => ids.includes(id),
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
        sites: [],
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
      sites: [],
      ids: [],
      secteurs: [],
      clientFilter: null,
      matchClient: () => true,
      matchCommercialId: () => true,
    };
  }, [viewAsRole, viewAsCommercial, viewAsManager, viewAsReferent, structure, bases]);

  return { ...persona, loading, structure };
}