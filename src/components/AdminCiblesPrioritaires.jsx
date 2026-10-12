import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Star, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Marque des clients déjà en base comme cibles prioritaires d'un commercial.
 * Sert aux commerciaux qui rendent leur fichier surligné après l'import initial.
 */
export default function AdminCiblesPrioritaires({ onReload }) {
  const [structure, setStructure] = useState([]);
  const [secteur, setSecteur] = useState('');
  const [texte, setTexte] = useState('');
  const [reinitialiser, setReinitialiser] = useState(true);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    base44.entities.structure_commerciale.list('-nom_commercial', 500)
      .then(setStructure).catch(() => {});
  }, []);

  // On accepte un copier-coller brut : on ne retient que les suites de 9 chiffres ou plus.
  const sirens = Array.from(new Set(
    (texte.match(/\d{9,14}/g) || []).map((d) => d.slice(0, 9))
  ));

  const envoyer = async () => {
    if (sirens.length === 0) { setErreur('Aucun SIREN détecté dans le texte collé.'); return; }
    setBusy(true); setErreur(''); setRes(null);
    try {
      const r = await base44.functions.invoke('marquer_cibles', {
        sirens,
        secteur: secteur || undefined,
        reinitialiser: Boolean(secteur) && reinitialiser
      });
      const d = r?.data ?? r;
      if (d?.error) throw new Error(d.error);
      setRes(d);
      onReload?.();
    } catch (e) {
      setErreur(e?.response?.data?.error || e?.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-gd-orange/30 bg-gd-orange/5 p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
        <Star className="h-4 w-4 text-gd-orange" fill="currentColor" /> Cibles prioritaires d'un commercial
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Pour un commercial qui rend son fichier surligné après l'import. Collez ses SIREN :
        les clients correspondants, <strong>déjà en base</strong>, passent en cible prioritaire
        (étoile et remontée en tête de « Mes clients »).
      </p>

      <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
        <div className="space-y-1.5">
          <Label>Commercial (secteur)</Label>
          <Select value={secteur || 'all'} onValueChange={(v) => setSecteur(v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Tous secteurs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous secteurs (déconseillé)</SelectItem>
              {structure.map((s) => (
                <SelectItem key={s.id} value={s.nom_commercial}>{s.nom_commercial}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {secteur && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={reinitialiser}
                onChange={(e) => setReinitialiser(e.target.checked)}
                className="mt-0.5"
              />
              <span>Effacer d'abord ses cibles actuelles (remplace au lieu de cumuler)</span>
            </label>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>SIREN surlignés ({sirens.length} détecté{sirens.length > 1 ? 's' : ''})</Label>
          <Textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={8}
            placeholder={'Collez ici — un par ligne, ou du texte brut :\n910348630\n480046762\n…'}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={envoyer} disabled={busy || sirens.length === 0} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
          {busy
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Application…</>
            : <><Star className="h-4 w-4 mr-1.5" fill="currentColor" /> Marquer {sirens.length} cible{sirens.length > 1 ? 's' : ''}</>}
        </Button>
        {!secteur && sirens.length > 0 && (
          <span className="text-xs text-amber-700">Sans secteur, un SIREN partagé marquerait aussi le client d'un collègue.</span>
        )}
      </div>

      {erreur && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erreur}
        </div>
      )}

      {res && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" /> {res.marques} client(s) marqué(s) en cible prioritaire
            {res.remis_a_zero > 0 ? ` · ${res.remis_a_zero} ancienne(s) cible(s) effacée(s)` : ''}
          </p>
          {res.introuvables?.length > 0 && (
            <div className="mt-2 text-xs text-amber-800">
              <p className="font-semibold">{res.introuvables.length} non trouvé(s) en base :</p>
              <p className="mt-1 break-all font-mono">{res.introuvables.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
