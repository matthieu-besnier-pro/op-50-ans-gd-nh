import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import { isDirection, isResponsable } from '@/lib/permissions';
import { Calendar, Wrench, User } from 'lucide-react';

export default function Calendrier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rdvs, setRdvs] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      let list = await base44.entities.rdv.list('-date_heure', 500);
      // Filter by role
      if (isDirection(user)) {
        // all
      } else if (isResponsable(user)) {
        list = list.filter((r) => r.base_responsable_id === user.id);
      } else {
        list = list.filter((r) => r.commercial_id === user.id);
      }
      setRdvs(list);
      const clientIds = [...new Set(list.map((r) => r.client_id))];
      const clientList = await Promise.all(clientIds.slice(0, 50).map((id) => base44.entities.client.get(id).catch(() => null)));
      const map = {};
      clientList.filter(Boolean).forEach((c) => { map[c.id] = c; });
      setClients(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const groups = {};
    rdvs.forEach((r) => {
      const day = (r.date_heure || '').slice(0, 10);
      if (!day) return;
      if (!groups[day]) groups[day] = [];
      groups[day].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [rdvs]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Calendrier</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rdvs.length} rendez-vous</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-24">Aucun rendez-vous.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gd-orange" />
                <h2 className="text-sm font-bold text-gd-navy">
                  {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <span className="text-xs text-muted-foreground">· {items.length} RDV</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => {
                  const client = clients[r.client_id];
                  return (
                    <div key={r.id} onClick={() => navigate(`/client/${r.client_id}`)} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm hover:bg-muted/30 cursor-pointer transition-colors">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg gd-gradient text-white">
                        <span className="text-xs font-bold">{new Date(r.date_heure).getHours()}h</span>
                        <span className="text-[10px]">{new Date(r.date_heure).getMinutes().toString().padStart(2, '0')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{client?.raison_sociale || 'Client'}</p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          {r.type === 'RDV atelier hivernage' ? <Wrench className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {r.type} · {r.duree_minutes || 30} min
                        </p>
                      </div>
                      <StatusBadge statut={r.statut} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}