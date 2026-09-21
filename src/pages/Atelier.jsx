import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import RdvExpress from '@/components/RdvExpress';
import { Button } from '@/components/ui/button';
import { Wrench, Plus } from 'lucide-react';

export default function Atelier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rdvs, setRdvs] = useState([]);
  const [clients, setClients] = useState({});
  const [allClients, setAllClients] = useState([]);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      let list = await base44.entities.rdv.filter({ type: 'RDV atelier hivernage' }, '-date_heure', 500);
      setRdvs(list);
      const clientIds = [...new Set(list.map((r) => r.client_id))];
      const [clientList, all] = await Promise.all([
        Promise.all(clientIds.slice(0, 50).map((id) => base44.entities.client.get(id).catch(() => null))),
        base44.entities.client.list('-raison_sociale', 2000).catch(() => [])
      ]);
      const map = {};
      clientList.filter(Boolean).forEach((c) => { map[c.id] = c; });
      setClients(map);
      setAllClients(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const rdvPris = rdvs.filter((r) => r.statut !== 'Annulé' && r.date_heure >= monthStart).length;
  const aVenir = rdvs.filter((r) => r.statut !== 'Annulé').sort((a, b) => a.date_heure.localeCompare(b.date_heure));

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gd-navy-dark">Atelier</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suivi des RDV hivernage</p>
        </div>
        <Button onClick={() => setRdvOpen(true)} className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> RDV hivernage
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="RDV hivernage pris (mois)" value={rdvPris} icon={Wrench} accent />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <h2 className="px-5 py-4 border-b border-border text-sm font-bold uppercase tracking-wider text-muted-foreground">RDV hivernage</h2>
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : aVenir.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Aucun RDV hivernage.</p>
        ) : (
          <div className="divide-y divide-border">
            {aVenir.map((r) => {
              const client = clients[r.client_id];
              return (
                <div key={r.id} onClick={() => navigate(`/client/${r.client_id}`)} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
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

      <RdvExpress open={rdvOpen} onOpenChange={setRdvOpen} clients={allClients} commercialId={user.id} defaultType="RDV atelier hivernage" onSaved={load} />
    </Layout>
  );
}