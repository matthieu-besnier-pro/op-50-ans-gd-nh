import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Check, X, MapPin } from 'lucide-react';

const ZONES = ['Centre', 'Ouest'];
const ENTITES = ['DBS', 'Quitte', 'Gonnin Duris'];

export default function AdminBases() {
  const [bases, setBases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nom: '', zone: 'Centre', entite: 'Gonnin Duris', responsable_id: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, u] = await Promise.all([
        base44.entities.base.list('-nom', 100),
        base44.entities.User.list('-created_date', 200).catch(() => [])
      ]);
      setBases(b);
      setUsers(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (base) => {
    setEditing(base.id || 'new');
    setForm({ nom: base.nom || '', zone: base.zone || 'Centre', entite: base.entite || 'Gonnin Duris', responsable_id: base.responsable_id || '' });
  };

  const cancelEdit = () => { setEditing(null); setForm({ nom: '', zone: 'Centre', entite: 'Gonnin Duris', responsable_id: '' }); };

  const handleSave = async () => {
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, responsable_id: form.responsable_id || null };
      if (editing === 'new') {
        await base44.entities.base.create(payload);
      } else {
        await base44.entities.base.update(editing, payload);
      }
      cancelEdit();
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette base ?')) return;
    try { await base44.entities.base.delete(id); load(); }
    catch (e) { console.error(e); }
  };

  const responsables = users.filter((u) => u.app_role === 'responsable' || u.app_role === 'direction');

  return (
    <div className="space-y-4">
      {editing === null ? (
        <div className="flex justify-end">
          <Button onClick={() => startEdit({})} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nouvelle base
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-gd-orange/30 bg-gd-orange/5 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gd-navy">{editing === 'new' ? 'Créer une base' : 'Modifier la base'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label>Nom du site</Label><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Entité</Label>
              <Select value={form.entite} onValueChange={(v) => setForm({ ...form, entite: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTITES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Select value={form.responsable_id} onValueChange={(v) => setForm({ ...form, responsable_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>—</SelectItem>
                  {responsables.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>)}
                </SelectContent>
              </Select>
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

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entité</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsable</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Chargement…</td></tr>
            ) : bases.map((b) => {
              const resp = users.find((u) => u.id === b.responsable_id);
              return (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gd-orange" /> {b.nom}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.zone}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.entite}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{resp?.full_name || resp?.email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(b)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}