import React, { useState, useEffect, useMemo } from 'react';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Search, X, UserPlus } from 'lucide-react';

export default function AdminAffectationManuelle({ commerciaux }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const c = await base44.entities.client.list('-created_date', 500);
      setClients(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = clients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.raison_sociale || '').toLowerCase().includes(q) ||
        (c.siren || '').includes(q) ||
        (c.code_commune || '').includes(q)
      );
    }
    if (filter === 'unassigned') list = list.filter((c) => !c.commerciaux_assignes || c.commerciaux_assignes.length === 0);
    if (filter === 'assigned') list = list.filter((c) => c.commerciaux_assignes && c.commerciaux_assignes.length > 0);
    return list;
  }, [clients, search, filter]);

  const assignCommercial = async (clientId, userId) => {
    if (!userId) return;
    setBusy(clientId);
    try {
      const client = clients.find((c) => c.id === clientId);
      const current = client.commerciaux_assignes || [];
      if (current.includes(userId)) return;
      const updated = [...current, userId];
      await base44.entities.client.update(clientId, { commerciaux_assignes: updated });
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, commerciaux_assignes: updated } : c)));
    } catch (e) { console.error(e); }
    finally { setBusy(null); }
  };

  const removeCommercial = async (clientId, userId) => {
    setBusy(clientId);
    try {
      const client = clients.find((c) => c.id === clientId);
      const updated = (client.commerciaux_assignes || []).filter((id) => id !== userId);
      await base44.entities.client.update(clientId, { commerciaux_assignes: updated });
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, commerciaux_assignes: updated } : c)));
    } catch (e) { console.error(e); }
    finally { setBusy(null); }
  };

  const getCommName = (id) => {
    const c = commerciaux.find((u) => u.id === id);
    return c?.full_name || c?.email || 'Inconnu';
  };

  if (loading) return <Loader compact label="Chargement des clients…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher (raison sociale, SIREN, commune)…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            <SelectItem value="unassigned">Non assignés uniquement</SelectItem>
            <SelectItem value="assigned">Assignés uniquement</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} client(s)</span>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun client trouvé.</p>
          ) : filtered.slice(0, 200).map((client) => (
            <div key={client.id} className="flex items-start gap-3 px-4 py-3 bg-card">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{client.raison_sociale}</p>
                <p className="text-xs text-muted-foreground">
                  {client.siren || 'SIREN —'} · Commune : {client.code_commune || '—'}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(!client.commerciaux_assignes || client.commerciaux_assignes.length === 0) ? (
                    <span className="text-xs font-semibold text-gd-red">⚠ Non assigné</span>
                  ) : (client.commerciaux_assignes || []).map((uid) => (
                    <span key={uid} className="inline-flex items-center gap-1 rounded-full bg-gd-navy/10 px-2 py-0.5 text-xs font-medium text-gd-navy">
                      {getCommName(uid)}
                      <button
                        onClick={() => removeCommercial(client.id, uid)}
                        disabled={busy === client.id}
                        className="ml-0.5 text-gd-navy/40 hover:text-gd-red disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 w-48">
                <Select
                  key={`${client.id}-${(client.commerciaux_assignes || []).join(',')}`}
                  onValueChange={(v) => assignCommercial(client.id, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <UserPlus className="h-3.5 w-3.5" /> Assigner…
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {commerciaux.filter((u) => !(client.commerciaux_assignes || []).includes(u.id)).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}