import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import StatusBadge from '@/components/StatusBadge';
import { STATUT_ATELIER, updatesApresStatutAtelier } from '@/lib/statutsAtelier';
import { PhoneCall, Check, Loader2 } from 'lucide-react';

// Suivi atelier d'un client : le rendez-vous ne se prend plus tout de suite. Le
// référent pose le statut « Contacté par l'atelier OK pour un RDV », qui se cumule
// avec les suivis déjà obtenus (RDV commercial ou autre), mentionnés à côté.
export default function StatutAtelier({ client, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const obtenus = Array.isArray(client.rdv_obtenus) ? client.rdv_obtenus : [];
  const pose = client.statut === STATUT_ATELIER;

  const marquer = async () => {
    if (saving || pose) return;
    setSaving(true); setErreur('');
    try {
      // Le chef d'atelier ne porte pas la fiche (elle est suivie par un commercial) :
      // l'enregistrement passe par le serveur, qui vérifie son périmètre SAV.
      const res = await base44.functions.invoke('maj_statut_sav', { client_id: client.id, updates: updatesApresStatutAtelier(client) })
        .catch((e) => ({ data: { error: e?.response?.data?.error || 'Enregistrement impossible' } }));
      if (res?.data?.error) throw new Error(res.data.error);
      invalider('client'); // la liste partagée doit refléter le nouveau statut
      onSaved?.();
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <StatusBadge statut={client.statut || 'À contacter'} />
      <button
        type="button"
        disabled={saving || pose}
        onClick={marquer}
        title={pose ? 'Statut déjà posé sur ce client' : "Le client a été contacté par l'atelier et est d'accord pour un rendez-vous."}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-left text-[11px] font-semibold transition ${
          pose
            ? 'border-gd-orange bg-gd-orange/15 text-gd-navy-dark'
            : 'border-border text-foreground hover:border-gd-orange hover:text-gd-orange'
        }`}
      >
        {saving
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : pose || obtenus.includes(STATUT_ATELIER) ? <Check className="h-3 w-3" /> : <PhoneCall className="h-3 w-3" />}
        {STATUT_ATELIER}
      </button>
      {erreur && <p className="text-xs text-gd-red">{erreur}</p>}
    </div>
  );
}