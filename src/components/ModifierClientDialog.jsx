import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';

// « 12 RUE DES CHAMPS 71000 MACON » → adresse / code postal / ville, pour une saisie séparée.
const decouper = (complet) => {
  const m = String(complet || '').match(/^(.*?)[,\s]+(\d{5})\s*(.*)$/);
  return m
    ? { adresse: m[1].trim(), code_postal: m[2], ville: m[3].trim() }
    : { adresse: String(complet || ''), code_postal: '', ville: '' };
};

// Correction d'une fiche client : client ajouté à la main, coordonnée erronée, SIREN manquant…
// L'enregistrement passe par la fonction modifier_client, qui contrôle le périmètre.
export default function ModifierClientDialog({ open, onOpenChange, client, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!open || !client) return;
    const { adresse, code_postal, ville } = decouper(client.adresse_complete);
    setForm({
      raison_sociale: client.raison_sociale || '',
      siren: client.siren || '',
      adresse,
      code_postal,
      ville,
      tel_mobile: client.tel_mobile || '',
      tel_fixe: client.tel_fixe || '',
      email: client.email || '',
      priorite_commercial: !!client.priorite_commercial
    });
    setErreur('');
  }, [open, client]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const enregistrer = async () => {
    if (!form) return;
    if (form.raison_sociale.trim().length < 2) { setErreur('Indiquez la raison sociale du client.'); return; }
    setSaving(true);
    setErreur('');
    try {
      const res = await base44.functions.invoke('modifier_client', { client_id: client.id, ...form });
      if (res?.data?.error) { setErreur(res.data.error); return; }
      invalider('client'); // la fiche et les listes doivent reprendre les nouvelles coordonnées
      onSaved?.(res?.data?.client);
      onOpenChange(false);
    } catch (e) {
      setErreur(e?.response?.data?.error || e?.message || "La fiche n'a pas pu être enregistrée. Vérifiez les informations et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gd-navy-dark">
            <Pencil className="h-5 w-5 text-gd-orange" /> Modifier la fiche client
          </DialogTitle>
          <DialogDescription>
            Corrigez les informations du client. Seule la raison sociale est obligatoire.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="m-raison">Raison sociale *</Label>
            <Input id="m-raison" value={form.raison_sociale} onChange={(e) => set('raison_sociale', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="m-siren">SIREN</Label>
            <Input id="m-siren" value={form.siren} onChange={(e) => set('siren', e.target.value)} placeholder="9 chiffres" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="m-mobile">Téléphone mobile</Label>
            <Input id="m-mobile" value={form.tel_mobile} onChange={(e) => set('tel_mobile', e.target.value)} placeholder="06 12 34 56 78" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="m-adresse">Adresse</Label>
            <Input id="m-adresse" value={form.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="12 rue des Champs" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="m-cp">Code postal</Label>
            <Input id="m-cp" value={form.code_postal} onChange={(e) => set('code_postal', e.target.value)} placeholder="71000" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="m-ville">Ville</Label>
            <Input id="m-ville" value={form.ville} onChange={(e) => set('ville', e.target.value)} placeholder="MACON" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="m-fixe">Téléphone fixe</Label>
            <Input id="m-fixe" value={form.tel_fixe} onChange={(e) => set('tel_fixe', e.target.value)} placeholder="03 85 00 00 00" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="m-email">Email</Label>
            <Input id="m-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@exemple.fr" className="mt-1" />
          </div>

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gd-orange/40 bg-gd-orange/5 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.priorite_commercial}
                onChange={(e) => set('priorite_commercial', e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--gd-orange))]"
              />
              <span className="text-sm font-semibold text-gd-navy-dark">Cible prioritaire</span>
              <span className="text-xs text-muted-foreground">— remonte en tête de « Mes clients »</span>
            </label>
          </div>
        </div>

        {erreur && <p className="text-sm font-medium text-destructive">{erreur}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={enregistrer} disabled={saving} className="bg-gd-orange text-gd-navy-dark hover:bg-gd-orange/90 font-semibold">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}