import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import OutlookCalendar from '@/components/OutlookCalendar';
import { isDirection, isResponsable } from '@/lib/permissions';
import { useDemoPersona } from '@/lib/useDemoPersona';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Calendar, Filter } from 'lucide-react';

export default function Calendrier() {
  const { user } = useAuth();
  const persona = useDemoPersona();
  const [rdvs, setRdvs] = useState([]);
  const [clients, setClients] = useState({});
  const [structure, setStructure] = useState([]);
  const [commFilter, setCommFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      let list = await base44.entities.rdv.list('-date_heure', 1000);
      if (persona.mode) {
        list = list.filter((r) => persona.matchCommercialId(r.commercial_id));
      } else if (isDirection(user)) {
        // tous
      } else if (isResponsable(user)) {
        list = list.filter((r) => r.base_responsable_id === user.id);
      } else {
        list = list.filter((r) => r.commercial_id === user.id);
      }
      setRdvs(list);
      const [clientList, structList] = await Promise.all([
        Promise.all([...new Set(list.map((r) => r.client_id))].slice(0, 100).map((id) => base44.entities.client.get(id).catch(() => null))),
        base44.entities.structure_commerciale.list('-nom_commercial', 300).catch(() => [])
      ]);
      const map = {};
      clientList.filter(Boolean).forEach((c) => { map[c.id] = c; });
      setClients(map);
      setStructure(structList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [persona.mode, persona.ids.join(',')]);

  // Commerciaux présents dans les RDV du périmètre (pour le filtre)
  const commByUser = useMemo(() => {
    const m = {};
    structure.forEach((s) => { if (s.user_id) m[s.user_id] = s.nom_commercial; });
    return m;
  }, [structure]);

  const commerciauxDispo = useMemo(() => {
    const ids = [...new Set(rdvs.map((r) => r.commercial_id).filter(Boolean))];
    return ids.map((id) => ({ id, nom: commByUser[id] || 'Commercial' })).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [rdvs, commByUser]);

  const showFilter = commerciauxDispo.length > 1;

  const rdvsFiltres = useMemo(() => (
    commFilter === 'all' ? rdvs : rdvs.filter((r) => r.commercial_id === commFilter)
  ), [rdvs, commFilter]);

  const upcomingCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return rdvsFiltres.filter((r) => r.date_heure?.slice(0, 10) >= todayStr && r.statut !== 'Annulé').length;
  }, [rdvsFiltres]);

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gd-navy-dark">Calendrier</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-gd-orange" />
            {rdvsFiltres.length} rendez-vous · {upcomingCount} à venir · export Outlook (.ics) disponible
          </p>
        </div>
        {showFilter && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={commFilter} onValueChange={setCommFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les commerciaux</SelectItem>
                {commerciauxDispo.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-gd-navy rounded-full animate-spin" /></div>
      ) : rdvsFiltres.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-24">Aucun rendez-vous.</p>
      ) : (
        <OutlookCalendar rdvs={rdvsFiltres} clients={clients} />
      )}
    </Layout>
  );
}
