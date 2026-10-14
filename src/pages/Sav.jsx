import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import SavOffres from '@/components/sav/SavOffres';
import SavListe from '@/components/sav/SavListe';
import RdvExpress from '@/components/RdvExpress';
import PortefeuilleFiltres from '@/components/PortefeuilleFiltres';
import { categorieMeta } from '@/components/MaterielPicto';
import { useAuth } from '@/lib/AuthContext';
import { useDemoPersona } from '@/lib/useDemoPersona';
import { useStatuts } from '@/lib/statuts';
import { listerPartage } from '@/lib/donneesPartagees';
import { clientPasseFiltres, categoriesDuParc } from '@/lib/filtresClients';
import { OFFRES_SAV } from '@/lib/offresSav';

// Filtres de la liste SAV : ceux de la partie commerciale, sans les scores d'appétence.
const FILTRES_INIT = {
  search: '',
  statut: 'all',
  commercial: 'all',
  suivi: 'all',
  parc: 'all',
  agri: 'all',
  site: 'all'
};

// Partie SAV de l'opération 50 ans, pour les chefs d'atelier et la Direction.
// Le périmètre est résolu côté serveur : cibles du fichier atelier du site
// + clients des commerciaux du site.
export default function Sav() {
  const { user } = useAuth();
  // « Voir en tant que » : le périmètre du référent choisi s'applique aussi ici.
  const persona = useDemoPersona();
  // Liste des statuts administrée par la Direction (Administration → Statuts).
  const statuts = useStatuts();
  const [clients, setClients] = useState([]);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState('toutes'); // cartes « offres SAV »
  // Filtres fins de la liste : les mêmes que la partie commerciale.
  const [filters, setFilters] = useState(FILTRES_INIT);
  // Client sur lequel on pose un rendez-vous atelier depuis la liste.
  const [rdvClient, setRdvClient] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [res, struct] = await Promise.all([
        base44.functions.invoke('lister_clients', { limit: 20000 }),
        // Noms des commerciaux (filtre « Commercial » et recherche), comme dans Mes clients.
        listerPartage('structure_commerciale', '-nom_commercial', 300).catch(() => [])
      ]);
      setClients(res?.data?.clients || []);
      setStructure(struct || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Liste de travail SAV : les cibles du fichier atelier, et les clients que les
  // commerciaux du site ont marqués « Offre SAV à proposer ». Chaque chef d'atelier ne
  // voit que son périmètre (tableau de répartition : ses sites et leurs commerciaux) —
  // assuré par le serveur pour un vrai compte, et par le référent choisi en mode démo.
  const travail = useMemo(
    () => clients.filter(
      (c) => (c.cible_atelier || c.statut === 'Offre SAV à proposer') && persona.matchClient(c)
    ),
    [clients, persona.matchClient]
  );

  // Noms des commerciaux assignés (structure commerciale) : recherche et filtre
  // « Commercial », avec repli sur le secteur d'import — comme la partie commerciale.
  const commByUser = useMemo(() => {
    const m = {};
    structure.forEach((s) => { if (s.user_id) m[s.user_id] = s.nom_commercial; });
    return m;
  }, [structure]);
  const commercialNames = (c) => {
    const noms = (c.commerciaux_assignes || []).map((id) => commByUser[id]).filter(Boolean);
    if (noms.length) return noms.join(', ');
    return c.secteur || '—';
  };

  // Options et compteurs des filtres : calculés sur la liste de travail SAV.
  const statutCounts = useMemo(() => {
    const counts = {};
    statuts.forEach((s) => { counts[s.nom] = 0; });
    travail.forEach((c) => { if (counts[c.statut] !== undefined) counts[c.statut] += 1; });
    return counts;
  }, [travail, statuts]);

  const commercialOptions = useMemo(() => {
    const opts = [];
    const seen = new Set();
    travail.forEach((c) => {
      (c.commerciaux_assignes || []).forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        opts.push({ value: id, label: commByUser[id] || 'Commercial' });
      });
      const assigned = c.commerciaux_assignes || [];
      if (assigned.length === 0 && c.secteur && !seen.has(`secteur:${c.secteur}`)) {
        seen.add(`secteur:${c.secteur}`);
        opts.push({ value: `secteur:${c.secteur}`, label: `${c.secteur} (import)` });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [travail, commByUser]);

  // Catégories de machines présentes dans les parcs ciblés.
  const parcOptions = useMemo(() => {
    const compte = {};
    travail.forEach((c) => {
      new Set(categoriesDuParc(c)).forEach((cat) => { compte[cat] = (compte[cat] || 0) + 1; });
    });
    return Object.entries(compte)
      .map(([value, nb]) => ({ value, nb, label: categorieMeta(value).label, emoji: categorieMeta(value).emoji }))
      .sort((a, b) => b.nb - a.nb);
  }, [travail]);

  const agriOptions = useMemo(() => {
    const compte = {};
    travail.forEach((c) => {
      new Set(c.sources_agri_precision || []).forEach((src) => { compte[src] = (compte[src] || 0) + 1; });
    });
    return Object.entries(compte)
      .map(([value, nb]) => ({ value, nb }))
      .sort((a, b) => b.nb - a.nb);
  }, [travail]);

  // Sites (agences) d'origine du ciblage atelier présents dans la liste.
  const siteOptions = useMemo(() => {
    const compte = {};
    travail.forEach((c) => { if (c.site_atelier) compte[c.site_atelier] = (compte[c.site_atelier] || 0) + 1; });
    return Object.entries(compte)
      .map(([value, nb]) => ({ value, nb, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [travail]);

  const compteurs = useMemo(() => {
    const par = Object.fromEntries(OFFRES_SAV.map((o) => [o, 0]));
    let aProposer = 0;
    travail.forEach((c) => {
      (c.offres_sav || []).forEach((o) => { if (par[o] !== undefined) par[o] += 1; });
      if (c.statut === 'Offre SAV à proposer') aProposer += 1;
    });
    return { par, aProposer, total: travail.length };
  }, [travail]);

  // Filtres fins (recherche, statut, parc, site…), puis carte d'offre sélectionnée.
  const liste = useMemo(() => {
    const parFiltres = travail.filter((c) => clientPasseFiltres(c, filters, { nomsCommerciaux: commercialNames(c) }));
    if (filtre === 'toutes') return parFiltres;
    if (filtre === 'statut') return parFiltres.filter((c) => c.statut === 'Offre SAV à proposer');
    return parFiltres.filter((c) => (c.offres_sav || []).includes(filtre));
  }, [travail, filtre, filters, commByUser]);

  // En mode démo, on attend aussi le référentiel qui détermine le périmètre du référent.
  if (loading || (persona.mode && persona.loading)) {
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

      {/* Mêmes filtres que la partie commerciale, sans les scores d'appétence :
          recherche, statut, suivi, parc cible, agri. précision, commercial, site. */}
      <PortefeuilleFiltres
        filters={filters}
        onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        onReset={() => setFilters(FILTRES_INIT)}
        statutCounts={statutCounts}
        commercials={commercialOptions}
        parcOptions={parcOptions}
        agriOptions={agriOptions}
        sites={siteOptions}
        showCommercial
        showAppetence={false}
        count={liste.length}
        total={travail.length}
      />

      <SavListe
        clients={liste}
        onSaved={load}
        onPrendreRdv={setRdvClient}
        nomCommerciaux={commercialNames}
      />

      {/* Le rendez-vous appartient à celui qui le pose : l'agenda consulté est le sien. */}
      <RdvExpress
        open={!!rdvClient}
        onOpenChange={(o) => { if (!o) setRdvClient(null); }}
        client={rdvClient}
        commercialId={user?.id}
        defaultType="RDV atelier hivernage"
        onSaved={load}
      />
    </Layout>
  );
}