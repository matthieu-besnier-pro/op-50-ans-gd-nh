import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import confetti from 'canvas-confetti';
import { Search, Tractor, Wrench, ChevronLeft, Check, Loader2, CalendarDays, PartyPopper } from 'lucide-react';

// Créneaux 08:00 → 18:00 par 30 min
const SLOTS = [];
for (let h = 8; h <= 18; h++) { SLOTS.push(`${String(h).padStart(2, '0')}:00`); if (h < 18) SLOTS.push(`${String(h).padStart(2, '0')}:30`); }

const dayISO = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const frDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export default function RdvExpress({ open, onOpenChange, client: clientProp, clients = [], commercialId, defaultType = 'RDV commercial', onSaved }) {
  const [step, setStep] = useState('client');
  const [client, setClient] = useState(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState(defaultType);
  const [day, setDay] = useState(dayISO(0));
  const [slot, setSlot] = useState(null);
  const [dayRdvs, setDayRdvs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setClient(clientProp || null);
      setStep(clientProp ? 'type' : 'client');
      setType(defaultType);
      setQuery(''); setDay(dayISO(0)); setSlot(null); setDayRdvs([]); setSaving(false); setDone(false);
    }
  }, [open, clientProp, defaultType]);

  const assigned = client?.commerciaux_assignes || [];
  const effectiveCommercialId = assigned.includes(commercialId) ? commercialId : (assigned[0] || commercialId);

  // Occupation des créneaux : RDV existants du commercial sur le jour choisi
  useEffect(() => {
    if (step !== 'slot' || !effectiveCommercialId || !day) return;
    let active = true;
    base44.entities.rdv.filter({
      commercial_id: effectiveCommercialId,
      date_heure: { $gte: day + 'T00:00:00', $lte: day + 'T23:59:59' },
      statut: { $ne: 'Annulé' }
    }, '-date_heure', 100).then((r) => { if (active) setDayRdvs(r); }).catch(() => {});
    return () => { active = false; };
  }, [step, effectiveCommercialId, day]);

  const occupied = useMemo(() => {
    const set = new Set();
    dayRdvs.forEach((r) => { if (r.date_heure) set.add(r.date_heure.slice(11, 16)); });
    return set;
  }, [dayRdvs]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => (c.raison_sociale || '').toLowerCase().includes(q) || (c.siren || '').includes(q)).slice(0, 8);
  }, [clients, query]);

  const confirmer = async () => {
    if (!client || !slot) return;
    setSaving(true);
    try {
      const dateHeure = new Date(`${day}T${slot}:00`).toISOString();
      await base44.entities.rdv.create({
        client_id: client.id,
        commercial_id: effectiveCommercialId,
        base_responsable_id: client.base_responsable_id || null,
        date_heure: dateHeure,
        duree_minutes: 30,
        type,
        statut: 'Planifié'
      });
      const updates = { date_prochain_rdv: day };
      if (type === 'RDV atelier hivernage') { updates.statut = 'Prise de RDV atelier'; updates.date_dernier_contact = dayISO(0); }
      await base44.entities.client.update(client.id, updates).catch(() => {});
      try { await base44.functions.invoke('verifier_badges', { utilisateur_id: effectiveCommercialId }); } catch (e) { /* ignore */ }

      // Récompense visuelle (sans son côté saisie ; le son est réservé au Grand Écran)
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ['#FFC107', '#0A2540', '#4ADE80'] });
      setDone(true);
      setTimeout(() => { onSaved?.(); onOpenChange(false); }, 1400);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const typeLabel = type === 'RDV atelier hivernage' ? 'Atelier' : 'Matériel';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {done ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
            <PartyPopper className="h-14 w-14 text-gd-orange" />
            <p className="text-xl font-extrabold text-gd-navy-dark">RDV pris ! 🎯</p>
            <p className="text-sm text-muted-foreground">{client?.raison_sociale} · {frDay(day)} à {slot}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* En-tête / progression */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3 bg-gd-navy text-white">
              {step !== 'client' && !clientProp && step !== 'type' && (
                <button onClick={() => setStep(step === 'slot' ? 'type' : 'client')} className="text-white/70 hover:text-white"><ChevronLeft className="h-5 w-5" /></button>
              )}
              <div className="flex-1">
                <p className="text-sm font-bold">Nouveau rendez-vous</p>
                <p className="text-[11px] text-white/60">
                  {client ? client.raison_sociale : 'Choisir un client'}{step === 'slot' ? ` · ${typeLabel}` : ''}
                </p>
              </div>
              <div className="flex gap-1">
                {['client', 'type', 'slot'].filter((s) => clientProp ? s !== 'client' : true).map((s) => (
                  <span key={s} className={`h-1.5 w-6 rounded-full ${step === s ? 'bg-gd-orange' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>

            <div className="p-5">
              {/* Étape 1 : client */}
              {step === 'client' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un client…"
                      className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm" />
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                    {filteredClients.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">Aucun client. Tapez pour rechercher.</p>
                    ) : filteredClients.map((c) => (
                      <button key={c.id} onClick={() => { setClient(c); setStep('type'); }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40">
                        <span className="text-sm font-medium text-foreground truncate">{c.raison_sociale}</span>
                        <span className="text-[11px] text-muted-foreground">{c.type_structure || ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Étape 2 : type */}
              {step === 'type' && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setType('RDV commercial'); setStep('slot'); }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-all ${type === 'RDV commercial' ? 'border-gd-orange bg-gd-orange/10' : 'border-border hover:bg-muted/40'}`}>
                    <Tractor className="h-10 w-10 text-gd-navy" />
                    <span className="text-sm font-bold text-gd-navy-dark">RDV Matériel</span>
                    <span className="text-[11px] text-muted-foreground">Commercial</span>
                  </button>
                  <button onClick={() => { setType('RDV atelier hivernage'); setStep('slot'); }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-all ${type === 'RDV atelier hivernage' ? 'border-gd-orange bg-gd-orange/10' : 'border-border hover:bg-muted/40'}`}>
                    <Wrench className="h-10 w-10 text-gd-navy" />
                    <span className="text-sm font-bold text-gd-navy-dark">RDV Atelier</span>
                    <span className="text-[11px] text-muted-foreground">Hivernage</span>
                  </button>
                </div>
              )}

              {/* Étape 3 : créneau */}
              {step === 'slot' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {[0, 1, 2, 3].map((o) => {
                      const iso = dayISO(o);
                      const label = o === 0 ? "Aujourd'hui" : o === 1 ? 'Demain' : frDay(iso);
                      return (
                        <button key={o} onClick={() => { setDay(iso); setSlot(null); }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${day === iso ? 'bg-gd-navy text-white' : 'bg-muted text-foreground hover:bg-muted/70'}`}>
                          {label}
                        </button>
                      );
                    })}
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <input type="date" value={day} onChange={(e) => { setDay(e.target.value); setSlot(null); }} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </label>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {SLOTS.map((s) => {
                      const taken = occupied.has(s);
                      const sel = slot === s;
                      return (
                        <button key={s} disabled={taken} onClick={() => setSlot(s)}
                          className={`rounded-lg py-2 text-sm font-semibold transition-all ${
                            taken ? 'bg-muted text-muted-foreground/40 line-through cursor-not-allowed'
                            : sel ? 'bg-gd-orange text-gd-navy-dark ring-2 ring-gd-orange'
                            : 'bg-muted/50 text-foreground hover:bg-gd-navy hover:text-white'}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={confirmer} disabled={!slot || saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gd-orange py-3 text-sm font-bold text-gd-navy-dark disabled:opacity-40 hover:brightness-110 transition-all">
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Confirmer le RDV{slot ? ` · ${frDay(day)} ${slot}` : ''}</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
