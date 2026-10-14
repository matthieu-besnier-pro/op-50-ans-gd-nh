import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invalider } from '@/lib/donneesPartagees';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { OFFRES_SAV, metaOffre, labelOffre } from '@/lib/offresSav';

const VIDE = { raison_sociale: '', siren: '', adresse: '', code_postal: '', ville: '', tel_mobile: '', tel_fixe: '', email: '' };

// Ajout manuel d'un client à cibler par l'atelier (SAV — OP 50 ans), avec l'offre
// à proposer — même principe que l'ajout côté commerce. Le ciblage (site, référents
// du site, offres) est posé côté serveur par creer_client_sav : le client entre
// aussitôt dans la liste de travail des référents de son site.
export default function AjouterClientSavDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(VIDE);
  const [offres, setOffres] = useState([]);
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  // SIREN déjà en base : le référent choisit entre compléter la fiche ou en créer une autre.
  const [conflit, setConflit] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Sites proposables : ceux du référent connecté (tous, pour la Direction).
  useEffect(() => {
    if (!open) return undefined;
    let annule = false;
    base44.functions.invoke('creer_client_sav', { liste_sites: true })
      .then((res) => {
        if (annule) return;
        const liste = res?.data?.sites || [];
        setSites(liste);
        setSite((s) => s || liste[0] || '');
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [open]);

  const basculer = (o) => setOffres((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]));

  const fermer = (ouvert) => {
    if (saving) return;
    onOpenChange(ouvert);
    if (!ouvert) { setForm(VIDE); setOffres([]); setErreur(''); setConflit(null); }
  };

  const enregistrer = async (options = {}) => {
    if (form.raison_sociale.trim().length < 2) { setErreur('Indiquez la raison sociale du client.'); return; }
    if (offres.length === 0) { setErreur('Choisissez au moins une offre SAV à proposer.'); return; }
    setSaving(true);
    setErreur('');
    try {
      const res = await base44.functions.invoke('creer_client_sav', {
        ...form,
        offres_sav: offres,
        site_atelier: site || null,
        ...options
      });
      if (res?.data?.conflit === 'siren') { setConflit(res.data.client_existant); return; }
      if (res?.data?.error) { setErreur(res.data.error); return; }
      invalider('client'); // le nouveau client doit apparaître dans la liste SAV
      onCreated?.(res?.data?.client);
      onOpenChange(false);
      setForm(VIDE);
      setOffres([]);
      setConflit(null);
    } catch (e) {
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
            <UserPlus className="h-5 w-5 text-gd-orange" /> Ajouter un client à cibler
          </DialogTitle>
          <DialogDescription>
            Pour un client rencontré à l'atelier et absent de la liste.
            Seule la raison sociale est obligatoire ; l'offre SAV indique quoi lui proposer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="raison">Raison sociale *</Label>
            <Input id="raison" value={form.raison_sociale} onChange={(e) => set('raison_sociale', e.target.value)} placeholder="EARL DES PRES" className="mt-1" />
          </div>

          {/* Offres SAV à proposer : au moins une. */}
          <div className="sm:col-span-2">
            <Label>Offres SAV à proposer *</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {OFFRES_SAV.map((o) => {
                const actif = offres.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => basculer(o)}
                    aria-pressed={actif}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      actif ? `${metaOffre(o).carte} ring-1 ring-current` : 'border-border text-muted-foreground hover:border-gd-navy/40 hover:text-gd-navy'
                    }`}
                  >
                    <span role="img" aria-hidden="true">{metaOffre(o).emoji}</span> {labelOffre(o)}
                  </button>
                );
              })}
            </div>
          </div>

          {sites.length > 0 && (
            <div className="sm:col-span-2">
              <Label>Site (atelier)</Label>
              <Select value={site || 'aucun'} onValueChange={(v) => setSite(v === 'aucun' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="aucun">Aucun site</SelectItem>
                  {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

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
        </div>

        {erreur && <p className="text-sm font-medium text-destructive">{erreur}</p>}

        {conflit && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">
              Ce SIREN existe déjà : « {conflit.raison_sociale} »
            </p>
            <p className="mt-1 text-xs text-amber-800">
              En complétant cette fiche, vous y ajoutez le ciblage atelier et ses offres,
              sans rien dupliquer. Créer une seconde fiche repart de zéro.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => enregistrer({ rattacher_existant: true })}
                disabled={saving}
                className="bg-gd-navy text-white hover:bg-gd-navy-dark"
              >
                Compléter cette fiche
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