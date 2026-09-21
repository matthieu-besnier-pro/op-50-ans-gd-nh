import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import Loader from '@/components/Loader';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Search, Users, UserCheck, UserX } from 'lucide-react';

const PAGE_SIZE = 50;

export default function AdminClientsListing({ commerciaux = [], bases = [] }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterComm, setFilterComm] = useState('all');
  const [filterBase, setFilterBase] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [total, setTotal] = useState(0);

  const commMap = useMemo(() => {
    const m = new Map();
    commerciaux.forEach((c) => m.set(c.id, c));
    return m;
  }, [commerciaux]);

  const baseMap = useMemo(() => {
    const m = new Map();
    bases.forEach((b) => m.set(b.id, b));
    return m;
  }, [bases]);

  const loadClients = async () => {
    setLoading(true);
    try {
      // Via la fonction backend (asServiceRole, projection légère) : rapide et
      // fonctionne pour la Direction quel que soit le rôle technique.
      const res = await base44.functions.invoke('lister_clients', { limit: 3000 });
      const allClients = res?.data?.clients || [];
      setClients(allClients);
      setTotal(allClients.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (search) {
        const s = search.toLowerCase();
        const match = (c.raison_sociale || '').toLowerCase().includes(s) ||
          (c.siren || '').toLowerCase().includes(s) ||
          (c.code_commune || '').toLowerCase().includes(s);
        if (!match) return false;
      }
      if (filterBase !== 'all' && c.base_id !== filterBase) return false;
      if (filterAssigned === 'assigned' && (!c.commerciaux_assignes || c.commerciaux_assignes.length === 0)) return false;
      if (filterAssigned === 'unassigned' && c.commerciaux_assignes && c.commerciaux_assignes.length > 0) return false;
      if (filterComm !== 'all') {
        if (!c.commerciaux_assignes || !c.commerciaux_assignes.includes(filterComm)) return false;
      }
      return true;
    });
  }, [clients, search, filterBase, filterAssigned, filterComm]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const commName = (id) => {
    const c = commMap.get(id);
    return c ? (c.full_name || c.email) : '—';
  };

  const baseName = (id) => {
    const b = baseMap.get(id);
    return b ? b.nom : '—';
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (raison sociale, SIREN, code commune)…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={filterAssigned} onValueChange={(v) => { setFilterAssigned(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            <SelectItem value="assigned">Assignés</SelectItem>
            <SelectItem value="unassigned">Non assignés</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterComm} onValueChange={(v) => { setFilterComm(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les commerciaux</SelectItem>
            {commerciaux.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBase} onValueChange={(v) => { setFilterBase(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les bases</SelectItem>
            {bases.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {filtered.length} client(s) affiché(s)
          {filtered.length !== total && ` sur ${total}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-emerald-600" />
          {clients.filter((c) => c.commerciaux_assignes && c.commerciaux_assignes.length > 0).length} assignés
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserX className="h-4 w-4 text-gd-red" />
          {clients.filter((c) => !c.commerciaux_assignes || c.commerciaux_assignes.length === 0).length} non assignés
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <Loader label="Chargement des clients…" />
        ) : pageData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Aucun client ne correspond aux filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Raison sociale</th>
                  <th className="px-4 py-3">SIREN</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">Code commune</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Commerciaux assignés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageData.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{c.raison_sociale || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.siren || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{baseName(c.base_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.code_commune || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {c.type_structure || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.commerciaux_assignes && c.commerciaux_assignes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.commerciaux_assignes.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-gd-navy/10 px-2 py-0.5 text-xs font-medium text-gd-navy">
                              <UserCheck className="h-3 w-3" />
                              {commName(id)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gd-red">
                          <UserX className="h-3 w-3" /> Non assigné
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} sur {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </button>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
              disabled={page >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}