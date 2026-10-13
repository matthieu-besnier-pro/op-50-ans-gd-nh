import React, { useState, useEffect, useMemo } from 'react';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Building2, Search, UserCog, Loader2, CheckCircle2 } from 'lucide-react';

export default function AdminStructureCommerciale() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEntite, setFilterEntite] = useState('all');
  // Affectation d'un responsable à plusieurs commerciaux (réorganisation d'équipe).
  const [manager, setManager] = useState('');
  const [selection, setSelection] = useState(() => new Set());
  const [affectation, setAffectation] = useState({ busy: false, message: '' });

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.structure_commerciale.list('-nom_commercial', 100);
        setRecords(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const managersExistants = useMemo(
    () => [...new Set(records.map((r) => (r.manager || '').trim()).filter(Boolean))].sort(),
    [records]
  );

  const basculer = (id) => setSelection((prev) => {
    const copie = new Set(prev);
    if (copie.has(id)) copie.delete(id); else copie.add(id);
    return copie;
  });

  const affecter = async () => {
    const nom = manager.trim();
    if (!nom || selection.size === 0) return;
    if (!window.confirm(`Affecter ${selection.size} commercial(aux) à ${nom} ?`)) return;
    setAffectation({ busy: true, message: '' });
    try {
      for (const id of selection) {
        await base44.entities.structure_commerciale.update(id, { manager: nom });
      }
      setRecords((prev) => prev.map((r) => (selection.has(r.id) ? { ...r, manager: nom } : r)));
      setAffectation({ busy: false, message: `${selection.size} commercial(aux) rattaché(s) à ${nom}.` });
      setSelection(new Set());
    } catch (e) {
      setAffectation({ busy: false, message: e?.message || "L'affectation a échoué." });
    }
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchSearch = !search ||
        r.nom_commercial?.toLowerCase().includes(search.toLowerCase()) ||
        r.manager?.toLowerCase().includes(search.toLowerCase());
      const matchEntite = filterEntite === 'all' || r.entite === filterEntite;
      return matchSearch && matchEntite;
    });
  }, [records, search, filterEntite]);

  const entites = ['GONNIN', 'DURIS', 'DBS', 'Quitté', 'AGRI PRECISION'];
  const stats = useMemo(() => {
    const byEntite = {};
    entites.forEach((e) => {
      byEntite[e] = records.filter((r) => r.entite === e);
    });
    return {
      total: records.length,
      totalCodes: records.reduce((s, r) => s + (r.codes_communes?.length || 0), 0),
      byEntite
    };
  }, [records]);

  if (loading) {
    return (
      <Loader compact />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Users className="h-3.5 w-3.5" /> Commerciaux
          </div>
          <p className="text-xl font-bold text-gd-navy-dark">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <MapPin className="h-3.5 w-3.5" /> Codes communes
          </div>
          <p className="text-xl font-bold text-gd-navy-dark">{stats.totalCodes}</p>
        </div>
        {entites.map((e) => (
          <div key={e} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Building2 className="h-3.5 w-3.5" /> {e}
            </div>
            <p className="text-xl font-bold text-gd-navy-dark">{stats.byEntite[e]?.length || 0}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par commercial ou manager…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterEntite('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterEntite === 'all' ? 'bg-gd-navy text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Toutes
          </button>
          {entites.map((e) => (
            <button
              key={e}
              onClick={() => setFilterEntite(e)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterEntite === e ? 'bg-gd-navy text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Affecter un responsable à plusieurs commerciaux */}
      <div className="mb-4 rounded-xl border-2 border-gd-navy/20 bg-gd-navy/5 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gd-navy-dark">
          <UserCog className="h-3.5 w-3.5 text-gd-orange" /> Affecter un responsable
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Cochez les commerciaux ci-dessous, indiquez leur responsable, puis appliquez.
          C'est ce rattachement qui alimente « Mon équipe » et fait apparaître le
          responsable dans la liste d'invitation.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <label className="text-xs text-muted-foreground">Responsable</label>
            <Input
              list="managers-existants"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              placeholder="Camille PELLO"
              className="mt-1 h-9"
            />
            <datalist id="managers-existants">
              {managersExistants.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <Button
            onClick={affecter}
            disabled={affectation.busy || !manager.trim() || selection.size === 0}
            className="h-9 bg-gd-navy hover:bg-gd-navy-dark text-white"
          >
            {affectation.busy
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Affectation…</>
              : <>Affecter {selection.size > 0 ? `(${selection.size})` : ''}</>}
          </Button>
        </div>
        {affectation.message && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {affectation.message}
          </p>
        )}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selection.has(r.id)}
                  onChange={() => basculer(r.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--gd-orange))]"
                  aria-label={`Sélectionner ${r.nom_commercial}`}
                />
                <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-foreground">{r.nom_commercial}</p>
                  <Badge variant="outline" className="text-xs">{r.entite}</Badge>
                  {r.statut === 'En attente' && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      En attente
                    </Badge>
                  )}
                  {r.statut === 'Actif' && (
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                      Actif
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manager : {r.manager || '—'}
                  {r.email ? ` · ${r.email}` : ''}
                </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-gd-orange">{r.codes_communes?.length || 0}</p>
                <p className="text-xs text-muted-foreground">codes communes</p>
              </div>
            </div>
            {r.codes_communes && r.codes_communes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
                {r.codes_communes.map((code) => (
                  <span key={code} className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Aucun commercial trouvé.</p>
        )}
      </div>
    </div>
  );
}