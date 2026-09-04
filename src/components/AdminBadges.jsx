import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const CONDITION_TYPES = [
  { value: 'premier_rdv', label: 'Premier RDV obtenu' },
  { value: 'sprint_13_14', label: 'Sprint 13-14' },
  { value: 'closeur', label: 'Closeur (vente conclue)' },
  { value: 'portefeuille_nettoye', label: 'Portefeuille nettoyé' },
  { value: 'chasseur_reprises', label: 'Chasseur de reprises' },
  { value: 'premier_devis', label: 'Premier devis' },
  { value: 'serie_active', label: 'Série active' }
];

const EMOJI_CHOICES = ['🏆', '🥇', '🚀', '🔥', '⭐', '💎', '🎯', '💪', '🎖️', '⚡', '🌟', '👑'];

export default function AdminBadges() {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nom: '', description: '', icone: '🏆', condition_type: 'premier_rdv', condition_seuil: 1 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.badge.list('-created_date', 50);
      setBadges(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (b) => {
    setEditing(b.id);
    setForm({ nom: b.nom, description: b.description || '', icone: b.icone || '🏆', condition_type: b.condition_type || 'premier_rdv', condition_seuil: b.condition_seuil || 1 });
  };

  const cancelEdit = () => { setEditing(null); setForm({ nom: '', description: '', icone: '🏆', condition_type: 'premier_rdv', condition_seuil: 1 }); };

  const handleSave = async () => {
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        await base44.entities.badge.create(form);
      } else {
        await base44.entities.badge.update(editing, form);
      }
      cancelEdit();
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce badge ?')) return;
    try {
      await base44.entities.badge.delete(id);
      load();
    } catch (e) { console.error(e); }
  };

  const isForm = editing !== null;

  return (
    <div className="space-y-4">
      {!isForm && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditing('new'); setForm({ nom: '', description: '', icone: '🏆', condition_type: 'premier_rdv', condition_seuil: 1 }); }} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nouveau badge
          </Button>
        </div>
      )}

      {isForm && (
        <div className="rounded-xl border border-gd-orange/30 bg-gd-orange/5 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gd-navy">{editing === 'new' ? 'Créer un badge' : 'Modifier le badge'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Nom</Label><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Description / condition</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Seuil</Label><Input type="number" value={form.condition_seuil} onChange={(e) => setForm({ ...form, condition_seuil: Number(e.target.value) })} /></div>
            <div className="space-y-1.5">
              <Label>Type de condition</Label>
              <Select value={form.condition_type} onValueChange={(v) => setForm({ ...form, condition_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Icône</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map((e) => (
                  <button key={e} type="button" onClick={() => setForm({ ...form, icone: e })}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xl transition-all ${form.icone === e ? 'border-gd-orange bg-gd-orange/20 scale-110' : 'border-border hover:bg-muted'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
              <Check className="h-4 w-4 mr-1.5" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button onClick={cancelEdit} variant="outline"><X className="h-4 w-4 mr-1.5" /> Annuler</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          <p className="col-span-full text-center text-sm text-muted-foreground py-8">Chargement…</p>
        ) : badges.map((b) => (
          <div key={b.id} className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start gap-3">
            <span className="text-3xl">{b.icone || '🏆'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{b.nom}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{b.description || '—'}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">Seuil : {b.condition_seuil || 1}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(b)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}