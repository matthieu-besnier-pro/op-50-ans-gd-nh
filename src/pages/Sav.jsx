import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import SavOffres from '@/components/sav/SavOffres';
import SavListe from '@/components/sav/SavListe';
import { OFFRES_SAV } from '@/lib/offresSav';

// Partie SAV de l'opération 50 ans, pour les chefs d'atelier et la Direction.
// Le périmètre est résolu côté serveur : cibles du fichier atelier du site
// + clients des commerciaux du site.
export default function Sav() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState('toutes');

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('lister_clients', { limit: 20000 });
      setClients(res?.data?.clients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Liste de travail SAV : les cibles du fichier atelier, et les clients que les
  // commerciaux du site ont marqués « Offre SAV à proposer ».
  const travail = useMemo(
    () => clients.filter((c) => c.cible_atelier || c.statut === 'Offre SAV à proposer'),
    [clients]
  );

  const compteurs = useMemo(() => {
    const par = Object.fromEntries(OFFRES_SAV.map((o) => [o, 0]));
    let aProposer = 0;
    travail.forEach((c) => {
      (c.offres_sav || []).forEach((o) => { if (par[o] !== undefined) par[o] += 1; });
      if (c.statut === 'Offre SAV à proposer') aProposer += 1;
    });
    return { par, aProposer, total: travail.length };
  }, [travail]);

  const liste = useMemo(() => {
    if (filtre === 'toutes') return travail;
    if (filtre === 'statut') return travail.filter((c) => c.statut === 'Offre SAV à proposer');
    return travail.filter((c) => (c.offres_sav || []).includes(filtre));
  }, [travail, filtre]);

  if (loading) {
    return <Layout><Loader label="Ouverture de la partie SAV…" /></Layout>;
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">SAV — OP 50 ans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offres SAV à proposer sur les clients ciblés de votre atelier, et suivi des offres SAV
          proposées par les commerciaux de votre site.
        </p>
      </div>

      <SavOffres compteurs={compteurs} filtre={filtre} onFiltre={setFiltre} />
      <SavListe clients={liste} onSaved={load} />
    </Layout>
  );
}