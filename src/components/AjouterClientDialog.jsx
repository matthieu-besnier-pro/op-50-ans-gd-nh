import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import { useAuth } from '@/lib/AuthContext';
import { getAppRole } from '@/lib/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';

const VIDE = { raison_sociale: '', siren: '', adresse: '', code_postal: '', ville: '', tel_mobile: '', tel_fixe: '', email: '' };

// Ajout manuel d'un client absent des fichiers d'import (le rattachement au
// commercial est fait côté serveur par la fonction creer_client_manuel).
export default function AjouterClientDialog({ open, onOpenChange, commercials = [], onCreated }) {
  const { user } = useAuth();
  const role = getAppRole(user);
  const estCommercial = role === 'commercial' || role === 'agri_precision' || role === 'commercial_chef_atelier';

  const [form, setForm] = useState(VIDE);
  const [commercialId, setCommercialId] = useState('');
  const [prioritaire, setPrioritaire] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  // SIREN déjà en base : on propose de se l'attribuer ou de créer quand même.
  const [conflit, setConflit] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fermer = (ouvert) => {
    if (saving) return;
    onOpenChange(ouvert);
    if (!ouvert) { setForm(VIDE); setCommercialId(''); setPrioritaire(false); setErreur(''); setConflit(null); }
  };

  const enregistrer = async (options = {}) => {
    if (form.raison_sociale.trim().length < 2) { setErreur('Indiquez la raison sociale du client.'); return; }
    setSaving(true);
    setErreur('');
    try {
      const res = await base44.functions.invoke('creer_client_manuel', {
        ...form,
        commercial_id: estCommercial ? null : (commercialId || null),
        priorite_commercial: prioritaire,
        ...options
      });
      // SIREN déjà connu : on laisse le commercial trancher plutôt que de le bloquer.
      if (res?.data?.conflit === 'siren') {
        setConflit(res.data.client_existant);
        setErreur('');
        return;
      }
      if (res?.data?.error) { setErreur(res.data.error); return; }
      invalider('client'); // le nouveau client doit apparaître dans les listes
      onCreated?.(res?.data?.client);
      onOpenChange(false);
      setForm(VIDE);
      setCommercialId('');
      setPrioritaire(false);
      setConflit(null);
    } catch (e) {
      // Une erreur renvoyée par la fonction (SIREN déjà pris, code postal…) arrive
      // sous forme d'exception : sans la remonter, l'utilisateur ne sait pas quoi corriger.
      const detail = e?.response?.data?.error || e?.data?.error || e?.message;
      setErreur(detail || "Le client n'a pas pu être enregistré. Vérifiez les informations et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={fermer}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gd-navy-dark">
            <UserPlus className="h-5 w-5 text-gd-orange" /> Ajouter un client
          </DialogTitle>
          <DialogDescription>
            Pour un client rencontré sur le terrain et absent de la liste.
            Seule la raison sociale est obligatoire.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="raison">Raison sociale *</Label>
            <Input id="raison" value={form.raison_sociale} onChange={(e) => set('raison_sociale', e.target.value)} placeholder="EARL DES PRES" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="siren">SIREN</Label>
            <Input id="siren" value={form.siren} onChange={(e) => set('siren', e.target.value)} placeholder="9 chiffres" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mobile">Téléphone mobile</Label>
            <Input id="mobile" value={form.tel_mobile} onChange={(e) => set('tel_mobile', e.target.value)} placeholder="06 12 34 56 78" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" value={form.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="12 rue des Champs" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cp">Code postal</Label>
            <Input id="cp" value={form.code_postal} onChange={(e) => set('code_postal', e.target.value)} placeholder="71000" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="ville">Ville</Label>
            <Input id="ville" value={form.ville} onChange={(e) => set('ville', e.target.value)} placeholder="MACON" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="fixe">Téléphone fixe</Label>
            <Input id="fixe" value={form.tel_fixe} onChange={(e) => set('tel_fixe', e.target.value)} placeholder="03 85 00 00 00" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@exemple.fr" className="mt-1" />
          </div>

          {!estCommercial && commercials.length > 0 && (
            <div className="sm:col-span-2">
              <Label>Commercial à affecter</Label>
              <Select value={commercialId || 'aucun'} onValueChange={(v) => setCommercialId(v === 'aucun' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="aucun">Aucun (à affecter plus tard)</SelectItem>
                  {commercials.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gd-orange/40 bg-gd-orange/5 px-3 py-2.5">
              <input
                type="checkbox"
                checked={prioritaire}
                onChange={(e) => setPrioritaire(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--gd-orange))]"
              />
              <span className="text-sm font-semibold text-gd-navy-dark">Cible prioritaire</span>
              <span className="text-xs text-muted-foreground">— remonte en tête de « Mes clients »</span>
            </label>
          </div>
        </div>

        {erreur && <p className="text-sm font-medium text-destructive">{erreur}</p>}

        {conflit && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">
              Ce SIREN existe déjà : « {conflit.raison_sociale} »
            </p>
            <p className="mt-1 text-xs text-amber-800">
              En vous l'attribuant, vous récupérez sa fiche complète — parc matériel,
              historique et rendez-vous. Créer une seconde fiche repart de zéro.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => enregistrer({ rattacher_existant: true })}
                disabled={saving}
                className="bg-gd-navy text-white hover:bg-gd-navy-dark"
              >
                Me l'attribuer
              </Button>
              <Button
                onClick={() => enregistrer({ forcer: true })}
                disabled={saving}
                variant="outline"
                className="border-amber-400 text-amber-900 hover:bg-amber-100"
              >
                Créer quand même
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => fermer(false)} disabled={saving}>Annuler</Button>
          <Button onClick={() => enregistrer()} disabled={saving} className="bg-gd-orange text-gd-navy-dark hover:bg-gd-orange/90 font-semibold">
            {saving ? 'Enregistrement…' : 'Ajouter le client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}