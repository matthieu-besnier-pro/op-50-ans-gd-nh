import React from 'react';
import StatusBadge from '@/components/StatusBadge';
import { Calendar } from 'lucide-react';

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtHeure = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// RDV du client affichés dans l'en-tête de sa fiche :
// les RDV à venir d'abord (le prochain mis en avant), puis les RDV passés.
export default function ClientRdvsEntete({ rdvs = [] }) {
  const now = new Date();
  const tries = [...rdvs].sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));
  const aVenir = tries.filter((r) => new Date(r.date_heure) >= now);
  const passes = tries.filter((r) => new Date(r.date_heure) < now).reverse();
  const liste = [...aVenir, ...passes];
  const prochainId = aVenir[0]?.id;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-4 w-4 text-gd-orange" /> Rendez-vous ({rdvs.length})
        </p>
        {aVenir.length > 0 && (
          <span className="rounded-full bg-gd-navy px-2 py-0.5 text-[11px] font-bold text-white">
            {aVenir.length} à venir
          </span>
        )}
      </div>

      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun RDV pour ce client.</p>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
          {liste.map((r) => {
            const prochain = r.id === prochainId;
            return (
              <div
                key={r.id}
                className={`rounded-lg border px-3 py-2 ${prochain ? 'border-gd-orange bg-gd-orange/10' : 'border-border bg-muted/40'}`}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {prochain && (
                    <span className="rounded-full bg-gd-orange px-1.5 py-0.5 text-[10px] font-bold uppercase text-gd-navy-dark">
                      Prochain
                    </span>
                  )}
                  {fmtDate(r.date_heure)} · {fmtHeure(r.date_heure)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.type} · {r.duree_minutes || 30} min</span>
                  <StatusBadge statut={r.statut} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}