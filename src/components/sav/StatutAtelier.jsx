import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import StatusBadge from '@/components/StatusBadge';
import {
  STATUT_ATELIER, STATUT_ATELIER_REFUS, updatesApresStatutAtelier,
  updatesApresAnnulationAtelier, contactAtelierPose
} from '@/lib/statutsAtelier';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { PhoneCall, Check, X, Loader2 } from 'lucide-react';

// Suivi atelier d'un client : le rendez-vous ne se prend plus tout de suite, le
// référent d'atelier marque d'un clic l'issue de son appel. Les deux issues sont
// grises tant qu'elles ne sont pas posées, puis passent au vert (accord pour un RDV)
// ou au rouge (refus). C'est ce clic qui compte la prise de contact atelier : une fois
// l'une des deux posée, l'autre n'est plus cliquable, donc jamais comptée deux fois.
// Une marque posée par erreur se retire en recliquant dessus, après confirmation.
export default function StatutAtelier({ client, onSaved }) {
  const [saving, setSaving] = useState('');
  const [erreur, setErreur] = useState('');
  // Marque posée sur laquelle on vient de recliquer : l'annulation attend confirmation.
  const [aAnnuler, setAAnnuler] = useState('');

  const obtenus = Array.isArray(client?.rdv_obtenus) ? client.rdv_obtenus : [];
  const dejaPose = (statut) => client?.statut === statut || obtenus.includes(statut);
  const okPose = dejaPose(STATUT_ATELIER);
  const refusPose = dejaPose(STATUT_ATELIER_REFUS);
  // Un contact a déjà été marqué : l'autre marque n'est pas cliquable.
  const verrouille = contactAtelierPose(client);

  // Le chef d'atelier ne porte pas la fiche (elle est suivie par un commercial) :
  // l'enregistrement passe par le serveur, qui vérifie son périmètre SAV.
  const enregistrer = async (updates) => {
    const res = await base44.functions.invoke('maj_statut_sav', { client_id: client.id, updates })
      .catch((e) => ({ data: { error: e?.response?.data?.error || 'Enregistrement impossible' } }));
    if (res?.data?.error) throw new Error(res.data.error);
    invalider('client'); // la liste partagée doit refléter le compteur de contacts
    onSaved?.();
  };

  const marquer = async (statut) => {
    if (saving || verrouille) return;
    setSaving(statut); setErreur('');
    try {
      await enregistrer(updatesApresStatutAtelier(client, statut));
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving('');
    }
  };

  // Annulation : le client ressort du suivi atelier et repasse dans les contacts à faire.
  const annuler = async (statut) => {
    setAAnnuler('');
    if (saving) return;
    setSaving(statut); setErreur('');
    try {
      await enregistrer(updatesApresAnnulationAtelier(client, statut));
    } catch (e) {
      setErreur(e?.message || 'Annulation impossible');
    } finally {
      setSaving('');
    }
  };

  // Une marque : grise tant que le contact n'est pas marqué, colorée (vert / rouge)
  // une fois posée. La marque posée reste cliquable pour l'annuler ; l'autre est
  // désactivée tant qu'un contact est marqué.
  const Marque = ({ statut, pose, couleur }) => {
    const vert = couleur === 'vert';
    const classes = pose
      ? (vert
        ? 'border-emerald-600 bg-emerald-600 text-white font-bold hover:bg-emerald-700'
        : 'border-gd-red bg-gd-red text-white font-bold hover:bg-gd-red/90')
      : `border-slate-300 bg-white text-slate-600 font-semibold ${verrouille ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500 hover:bg-slate-50'}`;
    return (
      <button
        type="button"
        disabled={saving !== '' || (verrouille && !pose)}
        onClick={() => (pose ? setAAnnuler(statut) : marquer(statut))}
        title={pose
          ? "Cliquez pour annuler ce contact atelier (une confirmation vous sera demandée)."
          : verrouille
            ? 'Un contact atelier est déjà marqué sur ce client.'
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

      <AlertDialog open={!!aAnnuler} onOpenChange={(ouvert) => { if (!ouvert) setAAnnuler(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce contact atelier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le statut « {aAnnuler} » sera retiré de la fiche de {client?.raison_sociale || 'ce client'} : il
              repassera dans les contacts à faire et ne sera plus compté dans les prises de contact atelier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non, garder</AlertDialogCancel>
            <AlertDialogAction onClick={() => annuler(aAnnuler)} className="bg-gd-red text-white hover:bg-gd-red/90">
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}