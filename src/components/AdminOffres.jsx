import React, { useState, useEffect } from 'react';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Check, X, ShoppingBag, Satellite } from 'lucide-react';

const TYPES = {
  magasin: { label: 'Offre magasin', icon: ShoppingBag, color: 'text-gd-orange' },
  agri_precision: { label: 'Agriculture de précision', icon: Satellite, color: 'text-emerald-600' },
};

export default function AdminOffres() {
  const [offres, setOffres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titre: '', type: 'magasin', date_debut: '', date_fin: '', ca_realise: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const o = await base44.entities.offre_magasin.list('-date_debut', 200);
      setOffres(o);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing('new');
    setForm({ titre: '', type: 'magasin', date_debut: '', date_fin: '', ca_realise: 0 });
  };

  const startEdit = (offre) => {
    setEditing(offre.id);
    setForm({
      titre: offre.titre || '',
      type: offre.type || 'magasin',
      date_debut: offre.date_debut || '',
      date_fin: offre.date_fin || '',
      ca_realise: offre.ca_realise || 0
    });
  };

  const save = async () => {
    if (!form.titre || !form.date_debut || !form.date_fin) return;
    try {
      if (editing === 'new') {
        await base44.entities.offre_magasin.create(form);
      } else {
        await base44.entities.offre_magasin.update(editing, form);
      }
      setEditing(null);
      load();
    } catch (e) { console.error(e); }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer cette offre ?')) return;
    try {
      await base44.entities.offre_magasin.delete(id);
      load();
    } catch (e) { console.error(e); }
  };

  if (loading) return <Loader compact />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gérez les offres magasin (animations, promotions, opérations spéciales).</p>
        <Button onClick={startNew} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Nouvelle offre
        </Button>
      </div>

      {editing && (
        <div className="rounded-xl border border-gd-orange/40 bg-gd-orange/5 p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">{editing === 'new' ? 'Nouvelle offre magasin' : 'Modifier l\'offre'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Titre de l'offre</Label>
              <Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="ex. Promotion hivernage 2026" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Type d'offre</Label>
              <div className="flex gap-2">
                {Object.entries(TYPES).map(([key, t]) => {
                  const Icon = t.icon;
                  const active = form.type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, type: key })}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${active ? 'border-gd-navy bg-gd-navy text-white' : 'border-border bg-card text-muted-foreground hover:border-gd-navy/40'}`}
                    >
                      <Icon className="h-4 w-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CA réalisé (€)</Label>
              <Input type="number" value={form.ca_realise} onChange={(e) => setForm({ ...form, ca_realise: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={save} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-4 w-4 mr-1.5" /> Enregistrer
            </Button>
            <Button onClick={() => setEditing(null)} size="sm" variant="outline">
              <X className="h-4 w-4 mr-1.5" /> Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {offres.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune offre magasin. Cliquez sur « Nouvelle offre » pour en créer une.</p>
        ) : (
          <div className="divide-y divide-border">
            {offres.map((o) => {
              const t = TYPES[o.type || 'magasin'] || TYPES.magasin;
              const TypeIcon = t.icon;
              return (
              <div key={o.id} className="flex items-center justify-between px-4 py-3 bg-card">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <TypeIcon className={`h-4 w-4 shrink-0 ${t.color}`} /> {o.titre}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t.label}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.date_debut || '—'} → {o.date_fin || '—'} · CA réalisé : {(o.ca_realise || 0).toLocaleString('fr-FR')} €
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button onClick={() => startEdit(o)} size="sm" variant="ghost">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => remove(o.id)} size="sm" variant="ghost" className="text-gd-red hover:bg-gd-red/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}