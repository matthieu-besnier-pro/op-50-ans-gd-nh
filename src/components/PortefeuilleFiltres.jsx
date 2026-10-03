import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Search, RotateCcw, SlidersHorizontal, Gauge, Flag, User,
  CalendarClock, ArrowDownWideNarrow
} from 'lucide-react';

const APPETENCES = ['Fort', 'Moyen', 'Faible'];
const APPETENCE_LABELS = {
  Fort: 'Fort (à saisir)',
  Moyen: 'Moyen (à cultiver)',
  Faible: 'Faible (à explorer)'
};

// Un champ de filtre : libellé + icône au-dessus, contrôle en dessous.
// Le libellé et l'icône passent en orange dès que le filtre est actif → repère visuel immédiat.
function Champ({ label, icone: Icone, actif = false, className, children }) {
  return (
    <div className={cn('min-w-0', className)}>
      <span
        className={cn(
          'mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider',
          actif ? 'text-gd-orange' : 'text-muted-foreground'
        )}
      >
        <Icone className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      {children}
    </div>
  );
}

const triggerClass = (actif) =>
  cn('w-full font-medium', actif && 'border-gd-orange/60 bg-gd-orange/10 text-gd-navy-dark');

// Barre de filtres du portefeuille : statut, appétence, commercial et suivi (RDV / rappels).
export default function PortefeuilleFiltres({
  filters,
  onChange,
  onReset,
  statutCounts = {},
  commercials = [],
  showCommercial = false,
  sortByAppetence,
  onToggleSort,
  count = 0,
  total = 0
}) {
  const nbActifs = Object.entries(filters).filter(([k, v]) => (k === 'search' ? !!v : v !== 'all')).length;
  const actif = (k) => (k === 'search' ? !!filters.search : filters[k] !== 'all');

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* En-tête : titre, nombre de filtres actifs, résultat, réinitialisation */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <p className="flex items-center gap-2 text-sm font-bold text-gd-navy-dark">
          <SlidersHorizontal className="h-4 w-4 text-gd-orange" />
          Affiner ma liste
          {nbActifs > 0 && (
            <span className="rounded-full bg-gd-orange px-2 py-0.5 text-xs font-bold text-gd-navy-dark">
              {nbActifs} filtre{nbActifs > 1 ? 's' : ''}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold tabular-nums text-foreground">
            {count.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')}
          </span>
          {nbActifs > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset} className="text-gd-navy hover:bg-gd-navy/10">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Réinitialiser
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Champ label="Recherche rapide" icone={Search} actif={actif('search')}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Raison sociale, SIREN, commune, commercial…"
              value={filters.search}
              onChange={(e) => onChange('search', e.target.value)}
              className={cn('pl-9', actif('search') && 'border-gd-orange/60 bg-gd-orange/10')}
            />
          </div>
        </Champ>

        <Champ label="Statut de l'opération" icone={Flag} actif={actif('statut')}>
          <Select value={filters.statut} onValueChange={(v) => onChange('statut', v)}>
            <SelectTrigger className={triggerClass(actif('statut'))}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statutCounts).map(([s, n]) => (
                <SelectItem key={s} value={s}>{s} ({n || 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Champ>

        <Champ label="Appétence" icone={Gauge} actif={actif('appetence')}>
          <Select value={filters.appetence} onValueChange={(v) => onChange('appetence', v)}>
            <SelectTrigger className={triggerClass(actif('appetence'))}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes appétences</SelectItem>
              {APPETENCES.map((a) => <SelectItem key={a} value={a}>{APPETENCE_LABELS[a]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Champ>

        <Champ label="Suivi (RDV / rappels)" icone={CalendarClock} actif={actif('suivi')}>
          <Select value={filters.suivi} onValueChange={(v) => onChange('suivi', v)}>
            <SelectTrigger className={triggerClass(actif('suivi'))}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout le suivi</SelectItem>
              <SelectItem value="rdv">Avec RDV à venir</SelectItem>
              <SelectItem value="rappel">Rappels à traiter</SelectItem>
            </SelectContent>
          </Select>
        </Champ>

        {showCommercial && commercials.length > 0 && (
          <Champ label="Commercial" icone={User} actif={actif('commercial')}>
            <Select value={filters.commercial} onValueChange={(v) => onChange('commercial', v)}>
              <SelectTrigger className={triggerClass(actif('commercial'))}><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Tous les commerciaux</SelectItem>
                {commercials.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
        )}

        <Champ label="Tri de la liste" icone={ArrowDownWideNarrow}>
          <Button
            variant={sortByAppetence ? 'default' : 'outline'}
            onClick={onToggleSort}
            className={cn(
              'w-full justify-start',
              sortByAppetence
                ? 'bg-gd-navy text-white hover:bg-gd-navy-dark'
                : 'border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white'
            )}
          >
            {sortByAppetence ? 'Meilleure appétence' : 'Ordre d\'ajout'}
          </Button>
        </Champ>
      </div>
    </div>
  );
}