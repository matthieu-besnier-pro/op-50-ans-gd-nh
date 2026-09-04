import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const TYPES_MACHINE = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger'];
const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];
const REPRISES = ['Sans reprise', 'Reprise NH', 'Reprise autre marque'];

export default function VenteDialog({ open, onOpenChange, client, commercialId, onSaved }) {
  const [form, setForm] = useState({
    date_vente: new Date().toISOString().slice(0, 10),
    type_machine: 'Tracteur',
    type_vente: 'Nouvelle commande',
    reprise: 'Sans reprise',
    marque_reprise: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        date_vente: new Date().toISOString().slice(0, 10),
        type_machine: 'Tracteur',
        type_vente: 'Nouvelle commande',
        reprise: 'Sans reprise',
        marque_reprise: ''
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        client_id: client.id,
        commercial_id: commercialId,
        date_vente: form.date_vente,
        type_machine: form.type_machine,
        type_vente: form.type_vente,
        reprise: form.reprise,
        source_declaration: 'Saisie manuelle',
        statut_validation: 'À valider'
      };
      if (form.reprise === 'Reprise autre marque') payload.marque_reprise = form.marque_reprise;
      if (client.base_responsable_id) payload.base_responsable_id = client.base_responsable_id;
      const vente = await base44.entities.vente.create(payload);
      onSaved?.(vente);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Déclarer une vente</DialogTitle>
          <DialogDescription>{client?.raison_sociale} — déclaration manuelle (à valider)</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de vente</Label>
              <Input type="date" value={form.date_vente} onChange={(e) => setForm({ ...form, date_vente: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type de machine</Label>
              <Select value={form.type_machine} onValueChange={(v) => setForm({ ...form, type_machine: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES_MACHINE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Type de vente</Label>
            <Select value={form.type_vente} onValueChange={(v) => setForm({ ...form, type_vente: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES_VENTE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reprise</Label>
            <Select value={form.reprise} onValueChange={(v) => setForm({ ...form, reprise: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPRISES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.reprise === 'Reprise autre marque' && (
            <div className="space-y-1.5">
              <Label>Marque de la reprise</Label>
              <Input value={form.marque_reprise} onChange={(e) => setForm({ ...form, marque_reprise: e.target.value })} placeholder="Ex. Valtra, John Deere…" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
            {saving ? 'Enregistrement…' : 'Déclarer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}