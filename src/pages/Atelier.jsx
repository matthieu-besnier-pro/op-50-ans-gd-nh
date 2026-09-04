import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Wrench, CalendarCheck, Clock } from 'lucide-react';

export default function Atelier() {
  const { user } = useAuth();
  const [rdvs, setRdvs] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      let list = await base44.entities.rdv.filter({ type: 'RDV atelier hivernage' }, '-date_heure', 500);
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const rdvPris = rdvs.filter((r) => r.statut !== 'Annulé' && r.date_heure >= monthStart).length;
  const rdvRealisesToday = rdvs.filter((r) => r.statut === 'Réalisé' && r.date_heure?.slice(0, 10) === todayStr).length;
  const aVenir = rdvs.filter((r) => r.statut === 'Planifié' && r.date_heure >= new Date().toISOString()).sort((a, b) => a.date_heure.localeCompare(b.date_heure));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Atelier</h1>
        <p className="mt-1 text-sm text-muted-foreground">Suivi des RDV hivernage</p>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="RDV hivernage pris (mois)" value={rdvPris} icon={Wrench} accent />
        <StatCard label="Réalisés aujourd'hui" value={rdvRealisesToday} icon={CalendarCheck} />
        <StatCard label="À venir" value={aVenir.length} icon={Clock} />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <h2 className="px-5 py-4 border-b border-border text-sm font-bold uppercase tracking-wider text-muted-foreground">RDV à venir</h2>
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : aVenir.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucun RDV à venir.</p>
        ) : (
          <div className="divide-y divide-border">
            {aVenir.map((r) => {
              const client = clients[r.client_id];
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-gd-navy">
                    <span className="text-xs font-bold">{new Date(r.date_heure).toLocaleDateString('fr-FR', { day: 'numeric' })}</span>
                    <span className="text-[10px] uppercase">{new Date(r.date_heure).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{client?.raison_sociale || 'Client'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {r.duree_minutes || 30} min</p>
                  </div>
                  <StatusBadge statut={r.statut} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}