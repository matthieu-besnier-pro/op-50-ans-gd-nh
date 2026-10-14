import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import StatusBadge from '@/components/StatusBadge';
import { MARQUES_ATELIER, updatesApresMarque } from '@/lib/statutsAtelier';
import { PhoneCall, ThumbsUp, Check, Loader2 } from 'lucide-react';

const ICONES = [PhoneCall, ThumbsUp];

// Suivi atelier d'un client : contacté par l'atelier, puis OK pour un RDV.
// Ces deux marques se cumulent avec les suivis déjà obtenus (RDV commercial ou
// autre), qui restent affichés à côté.
export default function MarquesAtelier({ client, onSaved }) {
  const [saving, setSaving] = useState('');
  const [erreur, setErreur] = useState('');
  const obtenus = Array.isArray(client.rdv_obtenus) ? client.rdv_obtenus : [];

  const poser = async (nom) => {
    if (saving || client.statut === nom) return;
    setSaving(nom); setErreur('');
    try {
      // Le chef d'atelier ne porte pas la fiche (elle est suivie par un commercial) :
      // l'enregistrement passe par le serveur, qui vérifie son périmètre SAV.
      const res = await base44.functions.invoke('maj_statut_sav', { client_id: client.id, updates: updatesApresMarque(client, nom) })
        .catch((e) => ({ data: { error: e?.response?.data?.error || 'Enregistrement impossible' } }));
      if (res?.data?.error) throw new Error(res.data.error);
      invalider('client'); // la liste partagée doit refléter la nouvelle marque
      onSaved?.();
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="space-y-1.5">
      <StatusBadge statut={client.statut || 'À contacter'} />
      <div className="flex flex-wrap gap-1">
        {MARQUES_ATELIER.map((m, i) => {
          const Icone = ICONES[i];
          const courant = client.statut === m.nom;
          const deja = obtenus.includes(m.nom);
          return (
            <button
              key={m.nom}
              type="button"
              title={m.aide}
              disabled={!!saving || courant}
              onClick={() => poser(m.nom)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition ${
                courant
                  ? 'border-gd-orange bg-gd-orange/15 text-gd-navy-dark'
                  : 'border-border text-foreground hover:border-gd-orange hover:text-gd-orange'
              }`}
            >
              {saving === m.nom
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : deja ? <Check className="h-3 w-3" /> : <Icone className="h-3 w-3" />}
              {m.nom}
            </button>
          );
        })}
      </div>
      {erreur && <p className="text-xs text-gd-red">{erreur}</p>}
    </div>
  );
}