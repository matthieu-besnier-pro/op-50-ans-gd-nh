import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import StatusBadge from '@/components/StatusBadge';
import {
  STATUT_ATELIER, STATUT_ATELIER_REFUS, updatesApresStatutAtelier, contactAtelierPose
} from '@/lib/statutsAtelier';
import { PhoneCall, Check, X, Loader2 } from 'lucide-react';

// Suivi atelier d'un client : le rendez-vous ne se prend plus tout de suite, le
// référent d'atelier marque d'un clic l'issue de son appel. Les deux issues sont
// grises tant qu'elles ne sont pas posées, puis passent au vert (accord pour un RDV)
// ou au rouge (refus). C'est ce clic qui compte la prise de contact atelier : une fois
// l'une des deux posée, l'autre n'est plus cliquable, donc jamais comptée deux fois.
export default function StatutAtelier({ client, onSaved }) {
  const [saving, setSaving] = useState('');
  const [erreur, setErreur] = useState('');
  const obtenus = Array.isArray(client?.rdv_obtenus) ? client.rdv_obtenus : [];
  const dejaPose = (statut) => client?.statut === statut || obtenus.includes(statut);
  const okPose = dejaPose(STATUT_ATELIER);
  const refusPose = dejaPose(STATUT_ATELIER_REFUS);
  // Un contact a déjà été marqué : plus aucun clic possible (ni dans un sens ni dans l'autre).
  const verrouille = contactAtelierPose(client);

  const marquer = async (statut) => {
    if (saving || verrouille) return;
    setSaving(statut); setErreur('');
    try {
      // Le chef d'atelier ne porte pas la fiche (elle est suivie par un commercial) :
      // l'enregistrement passe par le serveur, qui vérifie son périmètre SAV.
      const res = await base44.functions.invoke('maj_statut_sav', { client_id: client.id, updates: updatesApresStatutAtelier(client, statut) })
        .catch((e) => ({ data: { error: e?.response?.data?.error || 'Enregistrement impossible' } }));
      if (res?.data?.error) throw new Error(res.data.error);
      invalider('client'); // la liste partagée doit refléter le compteur de contacts
      onSaved?.();
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving('');
    }
  };

  // Une marque : grise tant que le contact n'est pas marqué, colorée (vert / rouge)
  // une fois posée, désactivée dès que l'autre issue a été choisie.
  const Marque = ({ statut, pose, couleur }) => {
    const vert = couleur === 'vert';
    const classes = pose
      ? (vert ? 'border-emerald-600 bg-emerald-600 text-white font-bold' : 'border-gd-red bg-gd-red text-white font-bold')
      : `border-slate-300 bg-white text-slate-600 font-semibold ${verrouille ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500 hover:bg-slate-50'}`;
    return (
      <button
        type="button"
        disabled={saving !== '' || verrouille}
        onClick={() => marquer(statut)}
        title={pose || verrouille
          ? "Contact atelier déjà pris : ce client est compté dans les prises de contact atelier."
          : vert
            ? "Un clic compte la prise de contact atelier : le client a été contacté et est d'accord pour un rendez-vous."
            : "Un clic compte la prise de contact atelier : le client a été contacté et ne donne pas suite."}
        className={`inline-flex items-center gap-1 rounded-md border-2 px-2 py-1 text-left text-[11px] transition ${classes}`}
      >
        {saving === statut
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : pose
            ? (vert ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />)
            : (vert ? <PhoneCall className="h-3 w-3" /> : <X className="h-3 w-3" />)}
        {statut}
      </button>
    );
  };

  return (
    <div className="space-y-1.5">
      {!okPose && !refusPose && <StatusBadge statut={client.statut || 'À contacter'} />}
      <div className="flex flex-wrap items-center gap-1.5">
        <Marque statut={STATUT_ATELIER} pose={okPose} couleur="vert" />
        <Marque statut={STATUT_ATELIER_REFUS} pose={refusPose} couleur="rouge" />
      </div>
      {erreur && <p className="text-xs text-gd-red">{erreur}</p>}
    </div>
  );
}