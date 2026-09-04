import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { AlertTriangle } from 'lucide-react';

export default function RdvDialog({ open, onOpenChange, client, commercialId, onSaved }) {
  const [form, setForm] = useState({
    date_heure: '',
    duree_minutes: 30,
    type: 'RDV commercial',
    statut: 'Planifié',
    notes: ''
  });
  const [overlap, setOverlap] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ date_heure: '', duree_minutes: 30, type: 'RDV commercial', statut: 'Planifié', notes: '' });
      setOverlap(null);
    }
  }, [open]);

  const checkOverlap = async (dateHeure, duree) => {
    if (!dateHeure || !commercialId) return;
    const start = new Date(dateHeure).getTime();
    const end = start + duree * 60000;
    const dayStart = new Date(dateHeure);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateHeure);
    dayEnd.setHours(23, 59, 59, 999);
    try {
      const rdvs = await base44.entities.rdv.filter({
        commercial_id: commercialId,
        date_heure: { $gte: dayStart.toISOString(), $lte: dayEnd.toISOString() },
        statut: { $ne: 'Annulé' }
      }, '-date_heure', 100);
      const conflict = rdvs.find((r) => {
        if (r.date_heure === dateHeure) return false;
        const rs = new Date(r.date_heure).getTime();
        const re = rs + (r.duree_minutes || 30) * 60000;
        return start < re && end > rs;
      });
      setOverlap(conflict || null);
    } catch (e) { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!form.date_heure) return;
    setSaving(true);
    try {
      const payload = {
        client_id: client.id,
        commercial_id: commercialId,
        date_heure: new Date(form.date_heure).toISOString(),
        duree_minutes: Number(form.duree_minutes) || 30,
        type: form.type,
        statut: form.statut,
        notes: form.notes
      };
      if (client.base_responsable_id) payload.base_responsable_id = client.base_responsable_id;
      const rdv = await base44.entities.rdv.create(payload);

      // Mettre à jour date_prochain_rdv du client
      const updates = { date_prochain_rdv: new Date(form.date_heure).toISOString().slice(0, 10) };
      if (form.type === 'RDV atelier hivernage') {
        updates.statut = 'Prise de RDV atelier';
        updates.date_dernier_contact = new Date().toISOString().slice(0, 10);
      }
      await base44.entities.client.update(client.id, updates);

      // Vérifier les badges
      try { await base44.functions.invoke('verifier_badges', { utilisateur_id: commercialId }); } catch (e) { /* ignore */ }

      onSaved?.(rdv);
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
          <DialogTitle>Nouveau rendez-vous</DialogTitle>
          <DialogDescription>{client?.raison_sociale}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Date et heure</Label>
            <Input
              type="datetime-local"
              value={form.date_heure}
              onChange={(e) => {
                setForm({ ...form, date_heure: e.target.value });
                checkOverlap(e.target.value, form.duree_minutes);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Durée (min)</Label>
              <Input
                type="number"
                value={form.duree_minutes}
                onChange={(e) => {
                  setForm({ ...form, duree_minutes: e.target.value });
                  checkOverlap(form.date_heure, e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RDV commercial">RDV commercial</SelectItem>
                  <SelectItem value="RDV atelier hivernage">RDV atelier hivernage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Planifié">Planifié</SelectItem>
                <SelectItem value="Réalisé">Réalisé</SelectItem>
                <SelectItem value="Annulé">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {overlap && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Conflit avec un autre RDV à {new Date(overlap.date_heure).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.date_heure} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}