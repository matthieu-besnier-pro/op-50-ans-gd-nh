import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Search, ListFilter, RotateCcw } from 'lucide-react';

const APPETENCES = ['Fort', 'Moyen', 'Faible'];
const APPETENCE_LABELS = {
  Fort: 'Fort (à saisir)',
  Moyen: 'Moyen (à cultiver)',
  Faible: 'Faible (à explorer)'
};
const PRIORITES = ['Haute', 'Moyenne', 'Normale'];

// Barre de filtres du portefeuille : statut, appétence, priorité, commercial,
// base, suivi (RDV / rappels) et parc cible (matériel éligible + catégorie de machine).
export default function PortefeuilleFiltres({
  filters,
  onChange,
  onReset,
  statutCounts = {},
  commercials = [],
  showCommercial = false,
  bases = [],
  categories = [],
  sortByPriority,
  onTogglePriority,
  count = 0,
  total = 0
}) {
  const hasActive = Object.entries(filters).some(([k, v]) => (k === 'search' ? !!v : v !== 'all'));

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (raison sociale, SIREN, commune, commercial)…"
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filters.statut} onValueChange={(v) => onChange('statut', v)}>
          <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(statutCounts).map(([s, n]) => (
              <SelectItem key={s} value={s}>{s} ({n || 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={sortByPriority ? 'default' : 'outline'}
          onClick={onTogglePriority}
          className={`shrink-0 ${sortByPriority ? 'bg-gd-navy hover:bg-gd-navy-dark text-white' : 'border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white'}`}
        >
          <ListFilter className="h-4 w-4 mr-1.5" /> Priorité
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Select value={filters.appetence} onValueChange={(v) => onChange('appetence', v)}>
          <SelectTrigger className="w-[176px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes appétences</SelectItem>
            {APPETENCES.map((a) => <SelectItem key={a} value={a}>{APPETENCE_LABELS[a]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.priorite} onValueChange={(v) => onChange('priorite', v)}>
          <SelectTrigger className="w-[164px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            {PRIORITES.map((p) => <SelectItem key={p} value={p}>Priorité {p.toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>

        {showCommercial && commercials.length > 0 && (
          <Select value={filters.commercial} onValueChange={(v) => onChange('commercial', v)}>
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Tous les commerciaux</SelectItem>
              {commercials.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {bases.length > 0 && (
          <Select value={filters.base} onValueChange={(v) => onChange('base', v)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Toutes les bases</SelectItem>
              {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filters.suivi} onValueChange={(v) => onChange('suivi', v)}>
          <SelectTrigger className="w-[188px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout le suivi</SelectItem>
            <SelectItem value="rdv">Avec RDV à venir</SelectItem>
            <SelectItem value="rappel">Rappels à traiter</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.parc} onValueChange={(v) => onChange('parc', v)}>
          <SelectTrigger className="w-[196px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout le parc cible</SelectItem>
            <SelectItem value="avec">Avec parc cible</SelectItem>
            <SelectItem value="sans">Sans parc cible (à conquérir)</SelectItem>
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select value={filters.categorie} onValueChange={(v) => onChange('categorie', v)}>
            <SelectTrigger className="w-[196px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Toutes les machines</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {hasActive && (
          <Button variant="ghost" onClick={onReset} className="text-gd-navy hover:bg-gd-navy/10">
            <RotateCcw className="h-4 w-4 mr-1.5" /> Réinitialiser
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {count.toLocaleString('fr-FR')} client{count > 1 ? 's' : ''} affiché{count > 1 ? 's' : ''} sur {total.toLocaleString('fr-FR')}
        {hasActive ? ' · filtres actifs' : ''}
      </p>
    </div>
  );
}