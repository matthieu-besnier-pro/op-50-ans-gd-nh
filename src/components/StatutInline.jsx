import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ChevronDown, Loader2, Check } from 'lucide-react';
import { useStatuts } from '@/lib/statuts';

const MOTIFS_REFUS = ['Pas de besoin', 'Concurrent', 'Budget', 'Autre'];

// Statuts qui réclament une information complémentaire avant d'être enregistrés.
const DEMANDE_INFO = {
  'À rappeler': 'rappel',
  'Refus': 'refus'
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Changement de statut directement depuis une liste, sans ouvrir la fiche client.
 * Applique les mêmes règles que la fiche : date de rappel obligatoire,
 * motif de refus obligatoire, incrément des tentatives sur « Injoignable ».
 */
export default function StatutInline({ client, user, onSaved, align = 'start' }) {
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [demande, setDemande] = useState(null); // { statut, type }
  const [dateRappel, setDateRappel] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [erreur, setErreur] = useState('');
  // Liste des statuts administrée par la Direction (Administration → Statuts).
  const statuts = useStatuts();

  const enregistrer = async (statut, extra = {}) => {
    setSaving(true); setErreur('');
    try {
      const updates = { statut, date_dernier_contact: aujourdhui(), ...extra };
      if (statut === 'Injoignable') {
        updates.nb_tentatives_contact = (client.nb_tentatives_contact || 0) + 1;
      }
      await base44.entities.client.update(client.id, updates);
      // Badges : toujours pour le commercial affecté au client (la fiche fait foi).
      const assignes = client.commerciaux_assignes || [];
      const badgeUserId = assignes.includes(user?.id) ? user.id : (assignes[0] || user?.id);
      if (badgeUserId) {
        base44.functions.invoke('verifier_badges', { utilisateur_id: badgeUserId }).catch(() => {});
      }
      onSaved?.({ ...client, ...updates });
      setDemande(null);
      setDateRappel(''); setMotifRefus('');
      setOk(true); setTimeout(() => setOk(false), 1200);
    } catch (e) {
      setErreur(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const choisir = (statut) => {
    if (statut === client.statut) return;
    const type = DEMANDE_INFO[statut];
    if (type) {
      setErreur('');
      setDateRappel(client.date_rappel || '');
      setMotifRefus(client.motif_refus || '');
      setDemande({ statut, type });
      return;
    }
    enregistrer(statut);
  };

  const validerDemande = () => {
    const { statut, type } = demande;
    if (type === 'rappel') {
      if (!dateRappel) { setErreur('La date de rappel est obligatoire.'); return; }
      return enregistrer(statut, { date_rappel: dateRappel });
    }
    if (type === 'refus') {
      if (!motifRefus) { setErreur('Le motif de refus est obligatoire.'); return; }
      return enregistrer(statut, { motif_refus: motifRefus });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={saving}>
          <button
            type="button"
            title="Changer le statut"
            className="inline-flex items-center gap-1 rounded-full transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-gd-orange/50"
          >
            <StatusBadge statut={client.statut || 'À contacter'} />
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              : ok
                ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-60">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Changer le statut
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {statuts.map((s) => (
            <DropdownMenuItem key={s.nom} onSelect={() => choisir(s.nom)} className="gap-2">
              <StatusBadge statut={s.nom} />
              {s.nom === client.statut && <Check className="ml-auto h-3.5 w-3.5 text-gd-navy" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!demande} onOpenChange={(v) => { if (!v) { setDemande(null); setErreur(''); } }}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {demande?.statut} — {client.raison_sociale}
            </DialogTitle>
          </DialogHeader>

          {demande?.type === 'rappel' && (
            <div className="space-y-1.5">
              <Label>Date de rappel <span className="text-gd-red">*</span></Label>
              <Input type="date" value={dateRappel} onChange={(e) => setDateRappel(e.target.value)} />
            </div>
          )}
          {demande?.type === 'refus' && (
            <div className="space-y-1.5">
              <Label>Motif de refus <span className="text-gd-red">*</span></Label>
              <Select value={motifRefus} onValueChange={setMotifRefus}>
                <SelectTrigger><SelectValue placeholder="Choisir un motif" /></SelectTrigger>
                <SelectContent>
                  {MOTIFS_REFUS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {erreur && <p className="text-sm text-gd-red">{erreur}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDemande(null); setErreur(''); }}>Annuler</Button>
            <Button onClick={validerDemande} disabled={saving} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Enregistrement…</> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {erreur && !demande && <p className="mt-1 text-xs text-gd-red">{erreur}</p>}
    </>
  );
}