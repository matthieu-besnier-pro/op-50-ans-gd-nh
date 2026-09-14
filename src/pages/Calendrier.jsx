import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import OutlookCalendar from '@/components/OutlookCalendar';
import { isDirection, isResponsable } from '@/lib/permissions';
import { useDemoPersona } from '@/lib/useDemoPersona';
import { Calendar } from 'lucide-react';

export default function Calendrier() {
  const { user } = useAuth();
  const persona = useDemoPersona();
  const [rdvs, setRdvs] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      let list = await base44.entities.rdv.list('-date_heure', 1000);
      if (persona.mode) {
        list = list.filter((r) => persona.matchCommercialId(r.commercial_id));
      } else if (isDirection(user)) {
        // all
      } else if (isResponsable(user)) {
        list = list.filter((r) => r.base_responsable_id === user.id);
      } else {
        list = list.filter((r) => r.commercial_id === user.id);
      }
      setRdvs(list);
      const clientIds = [...new Set(list.map((r) => r.client_id))];
      const clientList = await Promise.all(clientIds.slice(0, 100).map((id) => base44.entities.client.get(id).catch(() => null)));
      const map = {};
      clientList.filter(Boolean).forEach((c) => { map[c.id] = c; });
      setClients(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [persona.mode, persona.ids.join(',')]);

  const upcomingCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return rdvs.filter((r) => r.date_heure?.slice(0, 10) >= todayStr && r.statut !== 'Annulé').length;
  }, [rdvs]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Calendrier</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 text-gd-orange" />
          {rdvs.length} rendez-vous · {upcomingCount} à venir · export Outlook (.ics) disponible
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div>
      ) : rdvs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-24">Aucun rendez-vous.</p>
      ) : (
        <OutlookCalendar rdvs={rdvs} clients={clients} />
      )}
    </Layout>
  );
}