import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import StatusBadge from '@/components/StatusBadge';
import { STATUT_ATELIER, updatesApresStatutAtelier, contactAtelierPose } from '@/lib/statutsAtelier';
import { PhoneCall, Check, Loader2 } from 'lucide-react';

// Suivi atelier d'un client : le rendez-vous ne se prend plus tout de suite, le
// référent pose d'un clic le statut « Contacté par l'atelier OK pour un RDV ».
// C'est ce clic qui compte la prise de contact atelier : une fois posé, la marque
// passe au vert et n'est plus cliquable, donc jamais comptée deux fois.
export default function StatutAtelier({ client, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const pose = contactAtelierPose(client);

  const marquer = async () => {
    if (saving || pose) return;
    setSaving(true); setErreur('');
    try {
      // Le chef d'atelier ne porte pas la fiche (elle est suivie par un commercial) :
      // l'enregistrement passe par le serveur, qui vérifie son périmètre SAV.
      const res = await base44.functions.invoke('maj_statut_sav', { client_id: client.id, updates: updatesApresStatutAtelier(client) })
        .catch((e) => ({ data: { error: e?.response?.data?.error || 'Enregistrement impossible' } }));
      if (res?.data?.error) throw new Error(res.data.error);
      invalider('client'); // la liste partagée doit refléter le compteur de contacts
      onSaved?.();
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  // Contact atelier déjà pris : marque verte, en lecture seule (aucun clic possible).
  if (pose) {
    return (
      <div className="space-y-1.5">
        {client.statut !== STATUT_ATELIER && <StatusBadge statut={client.statut || 'À contacter'} />}
        <span
          title="Contact atelier déjà pris : ce client est compté dans les prises de contact atelier."
          className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-600 bg-emerald-600 px-2 py-1 text-left text-[11px] font-bold text-white"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          {STATUT_ATELIER}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <StatusBadge statut={client.statut || 'À contacter'} />
      <button
        type="button"
        disabled={saving}
        onClick={marquer}
        title="Un clic compte la prise de contact atelier : le client a été contacté et est d'accord pour un rendez-vous."
        className="inline-flex items-center gap-1 rounded-md border-2 border-emerald-300 bg-white px-2 py-1 text-left text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-600 hover:bg-emerald-50"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}
        {STATUT_ATELIER}
      </button>
      {erreur && <p className="text-xs text-gd-red">{erreur}</p>}
    </div>
  );
}