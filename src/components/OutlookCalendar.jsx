import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Calendar as CalIcon,
  Download, Wrench, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateICS, generateICSAll, downloadICS } from '@/lib/icsExport';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8h → 20h
const HOUR_HEIGHT = 56; // px
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=dim, 1=lun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function rdvOnDate(rdv, date) {
  return rdv.date_heure && sameDay(new Date(rdv.date_heure), date);
}

export default function OutlookCalendar({ rdvs, clients }) {
  const navigate = useNavigate();
  const [view, setView] = useState('week'); // 'day' | 'week' | 'month'
  const [current, setCurrent] = useState(new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const navigatePrev = () => {
    const d = new Date(current);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrent(d);
  };
  const navigateNext = () => {
    const d = new Date(current);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrent(d);
  };

  const title = useMemo(() => {
    if (view === 'day') return current.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'week') {
      const s = startOfWeek(current);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
  }, [view, current]);

  const handleExportOne = (rdv) => {
    const ics = generateICS(rdv, clients[rdv.client_id]);
    downloadICS(ics, `rdv-${rdv.id}.ics`);
  };

  const handleExportAll = () => {
    const ics = generateICSAll(rdvs, clients);
    downloadICS(ics, 'tous-les-rdv.ics');
  };

  const goToday = () => setCurrent(new Date());

  // ---- DAY VIEW ----
  const DayView = () => {
    const dayRdvs = rdvs.filter((r) => rdvOnDate(r, current)).sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));
    return (
      <div className="flex rounded-xl border border-border bg-card overflow-hidden">
        <div className="w-16 shrink-0 border-r border-border">
          {HOURS.map((h) => (
            <div key={h} className="text-right pr-2 text-xs text-muted-foreground border-b border-border/50" style={{ height: HOUR_HEIGHT }}>
              {h}h
            </div>
          ))}
        </div>
        <div className="flex-1 relative">
          {HOURS.map((h) => (
            <div key={h} className="border-b border-border/30" style={{ height: HOUR_HEIGHT }} />
          ))}
          {dayRdvs.map((r) => <EventBlock key={r.id} rdv={r} clientName={clients[r.client_id]?.raison_sociale} onClick={() => navigate(`/client/${r.client_id}`)} onExport={() => handleExportOne(r)} />)}
          {dayRdvs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Aucun RDV ce jour</div>
          )}
        </div>
      </div>
    );
  };

  // ---- WEEK VIEW ----
  const WeekView = () => {
    const start = startOfWeek(current);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-muted/30">
          <div />
          {days.map((d, i) => (
            <div key={i} className={`px-2 py-2 text-center border-l border-border/50 ${sameDay(d, today) ? 'bg-gd-orange/10' : ''}`}>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{WEEKDAYS[i]}</p>
              <p className={`text-lg font-bold ${sameDay(d, today) ? 'text-gd-orange' : 'text-foreground'}`}>{d.getDate()}</p>
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
          <div>
            {HOURS.map((h) => (
              <div key={h} className="text-right pr-2 text-xs text-muted-foreground border-b border-border/30" style={{ height: HOUR_HEIGHT }}>{h}h</div>
            ))}
          </div>
          {days.map((d, i) => {
            const dayRdvs = rdvs.filter((r) => rdvOnDate(r, d)).sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));
            return (
              <div key={i} className={`relative border-l border-border/50 ${sameDay(d, today) ? 'bg-gd-orange/5' : ''}`}>
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border/30" style={{ height: HOUR_HEIGHT }} />
                ))}
                {dayRdvs.map((r) => <EventBlock key={r.id} rdv={r} clientName={clients[r.client_id]?.raison_sociale} compact onClick={() => navigate(`/client/${r.client_id}`)} onExport={() => handleExportOne(r)} />)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- MONTH VIEW ----
  const MonthView = () => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1; // lun=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground border-l border-border/50 first:border-l-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[96px] border-l border-t border-border/30 first:border-l-0 bg-muted/10" />;
            const dayRdvs = rdvs.filter((r) => rdvOnDate(r, d));
            const isToday = sameDay(d, today);
            return (
              <div key={i} className={`min-h-[96px] border-l border-t border-border/30 first:border-l-0 p-1.5 ${isToday ? 'bg-gd-orange/5' : ''}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-gd-orange text-gd-navy-dark' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                <div className="mt-1 space-y-1">
                  {dayRdvs.slice(0, 3).map((r) => (
                    <div key={r.id} onClick={() => navigate(`/client/${r.client_id}`)} className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${r.type === 'RDV atelier hivernage' ? 'bg-gd-orange/20 text-gd-navy' : 'bg-gd-navy/10 text-gd-navy'}`}>
                      {new Date(r.date_heure).getHours()}h {clients[r.client_id]?.raison_sociale || 'Client'}
                    </div>
                  ))}
                  {dayRdvs.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{dayRdvs.length - 3} autres</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>
          <Button variant="ghost" size="icon" onClick={navigatePrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={navigateNext}><ChevronRight className="h-4 w-4" /></Button>
          <h2 className="ml-1 text-lg font-bold text-gd-navy-dark capitalize">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {[
              { key: 'day', label: 'Jour', icon: CalIcon },
              { key: 'week', label: 'Semaine', icon: CalendarDays },
              { key: 'month', label: 'Mois', icon: CalendarRange }
            ].map((v) => {
              const Icon = v.icon;
              return (
                <button key={v.key} onClick={() => setView(v.key)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === v.key ? 'bg-gd-navy text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                  <Icon className="h-3.5 w-3.5" /> {v.label}
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAll}>
            <Download className="h-4 w-4" /> Exporter (.ics)
          </Button>
        </div>
      </div>

      {view === 'day' && <DayView />}
      {view === 'week' && <WeekView />}
      {view === 'month' && <MonthView />}
    </div>
  );
}

// Event block positioned absolutely in the time grid
function EventBlock({ rdv, clientName, onClick, onExport, compact }) {
  const start = new Date(rdv.date_heure);
  const duration = rdv.duree_minutes || 30;
  const topMinutes = (start.getHours() - 8) * 60 + start.getMinutes();
  const top = (topMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max((duration / 60) * HOUR_HEIGHT - 2, 22);
  const isAtelier = rdv.type === 'RDV atelier hivernage';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 text-white shadow-sm cursor-pointer hover:z-20 hover:shadow-md transition-shadow ${isAtelier ? 'bg-gd-orange/90 border-gd-navy' : 'bg-gd-navy/90 border-gd-orange'}`}
      style={{ top, height }}
    >
      <div className="flex items-center gap-1">
        {isAtelier ? <Wrench className="h-3 w-3 shrink-0" /> : <User className="h-3 w-3 shrink-0" />}
        <span className="truncate text-xs font-bold">{start.getHours()}h{String(start.getMinutes()).padStart(2, '0')}</span>
      </div>
      {!compact && (
        <p className="truncate text-xs font-medium opacity-90">{clientName || 'Client'}</p>
      )}
      {!compact && (
        <button
          onClick={(e) => { e.stopPropagation(); onExport(); }}
          className="mt-0.5 flex items-center gap-1 text-[10px] opacity-80 hover:opacity-100"
          title="Exporter vers Outlook"
        >
          <Download className="h-2.5 w-2.5" /> Outlook
        </button>
      )}
    </div>
  );
}