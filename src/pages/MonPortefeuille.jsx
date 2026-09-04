import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import AppetenceBadge from '@/components/AppetenceBadge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Search, Award, Phone, Calendar, ChevronRight, Trophy } from 'lucide-react';

const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite', 'RDV obtenu', 'Prise de RDV atelier', 'Devis en cours', 'Offre magasin à proposer', 'Vente conclue', 'Refus'];

export default function MonPortefeuille() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('all');
  const [badges, setBadges] = useState([]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.client.filter(
        { commerciaux_assignes: user.id },
        '-date_dernier_contact',
        500
      );
      setClients(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadBadges = async () => {
    try {
      const obtenus = await base44.entities.badge_obtenu.filter({ utilisateur_id: user.id }, '-created_date', 50);
      if (obtenus.length === 0) return;
      const badgeIds = obtenus.map((o) => o.badge_id);
      const allBadges = await base44.entities.badge.list('-created_date', 50);
      const mine = allBadges.filter((b) => badgeIds.includes(b.id));
      setBadges(mine);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (user?.id) {
      loadClients();
      loadBadges();
    }
  }, [user?.id]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (statutFilter !== 'all' && c.statut !== statutFilter) return false;
      if (search && !(c.raison_sociale || '').toLowerCase().includes(search.toLowerCase()) && !(c.siren || '').includes(search)) return false;
      return true;
    });
  }, [clients, search, statutFilter]);

  const statutCounts = useMemo(() => {
    const counts = {};
    STATUTS.forEach((s) => counts[s] = 0);
    clients.forEach((c) => { if (counts[c.statut] !== undefined) counts[c.statut]++; });
    return counts;
  }, [clients]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Mon portefeuille</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {clients.length} client{clients.length > 1 ? 's' : ''} assigné{clients.length > 1 ? 's' : ''} · {statutCounts['À contacter']} à contacter
        </p>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {badges.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-full border border-gd-orange/30 bg-gd-orange/10 px-3 py-1.5">
              <span className="text-lg">{b.icone || '🏆'}</span>
              <span className="text-sm font-semibold text-gd-navy">{b.nom}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (raison sociale, SIREN)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS.map((s) => (
              <SelectItem key={s} value={s}>{s} ({statutCounts[s] || 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raison sociale</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appétence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dernier contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prochain RDV</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun client.</td></tr>
            ) : filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/client/${c.id}`)}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground text-sm">{c.raison_sociale}</p>
                  <p className="text-xs text-muted-foreground">{c.type_structure || 'Exploitation'} · {c.siren || '—'}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge statut={c.statut} /></td>
                <td className="px-4 py-3"><AppetenceBadge niveau={c.niveau_appetence} score={c.score_appetence} /></td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.date_dernier_contact || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.date_prochain_rdv || '—'}</td>
                <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}