import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle2, AlertTriangle, Users, ClipboardList } from 'lucide-react';

// Import de la partie SAV : la répartition des chefs d'atelier par secteur (fichier CSV),
// puis le fichier consolidé des cibles atelier (Excel). Le dépôt se fait côté serveur
// (lecture du fichier par la fonction d'import) : le fichier est stocké de façon privée
// et lu via une URL signée temporaire.
async function urlSignee(file) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 900 });
  return signed_url;
}

function Bloc({ titre, description, icone: Icone, fonction, accept, onReload, children }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [resultat, setResultat] = useState(null);

  const envoyer = async (file) => {
    if (!file) return;
    setBusy(true); setErreur(null); setResultat(null);
    try {
      const url = await urlSignee(file);
      const res = await base44.functions.invoke(fonction, { file_url: url });
      if (res?.data?.error) throw new Error(res.data.error);
      setResultat(res.data);
      onReload?.();
    } catch (e) {
      setErreur(e?.response?.data?.error || e?.message || 'Import impossible');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Icone className="h-4 w-4 text-gd-orange" /> {titre}
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => envoyer(e.target.files[0])} />
      <Button onClick={() => ref.current?.click()} disabled={busy} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
        {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Import en cours…</> : <><Upload className="h-4 w-4 mr-1.5" /> Choisir le fichier</>}
      </Button>

      {erreur && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erreur}
        </div>
      )}
      {resultat && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Import terminé</p>
          {children?.(resultat)}
        </div>
      )}
    </div>
  );
}

export default function AdminImportSav({ onReload }) {
  return (
    <div className="space-y-5">
      <Bloc
        titre="Répartition des chefs d'atelier"
        description="Fichier des commerciaux et chefs d'atelier par secteur (CSV). Il complète les sites existants : chef d'atelier, responsable SAV, zone, entité et commerciaux rattachés. Aucune donnée en place n'est effacée."
        icone={Users}
        fonction="importer_repartition_atelier"
        accept=".csv,.txt"
        onReload={onReload}
      >
        {(r) => (
          <p className="mt-1 text-xs">
            {r.sites?.length || 0} site(s) mis à jour{r.sites?.some((s) => s.cree) ? `, dont ${r.sites.filter((s) => s.cree).length} créé(s)` : ''} sur {r.lignes} ligne(s).
          </p>
        )}
      </Bloc>

      <Bloc
        titre="Cibles atelier — fichier consolidé"
        description="Fichier consolidé des clients ciblés par l'atelier (Excel), avec l'offre SAV à proposer (inspection annuelle, révision, contrat de service). Les fiches déjà présentes sont complétées, les autres créées : elles ne sont visibles que par les chefs d'atelier de leur site."
        icone={ClipboardList}
        fonction="importer_cible_atelier"
        accept=".xlsx,.xls"
        onReload={onReload}
      >
        {(r) => (
          <div className="mt-1 space-y-0.5 text-xs">
            <p>
              {r.clients} client(s) ciblé(s) : {r.clientsCrees} créé(s), {r.clientsCompletes} complété(s)
              {r.clientsCompletes > 0 ? ` (dont les fiches déjà au portefeuille d'un commercial, visibles par les deux)` : ''} · {r.machinesCreees} machine(s), {r.machinesMaj} offre(s) SAV complétée(s).
            </p>
            {r.sitesInconnus?.length > 0 && (
              <p className="font-semibold text-amber-700">Sites non reconnus : {r.sitesInconnus.join(', ')}.</p>
            )}
            {r.chefsInconnus?.length > 0 && (
              <p className="font-semibold text-amber-700">
                Chefs d'atelier sans compte : {r.chefsInconnus.join(', ')}. Invitez-les (rôle « Chef d'atelier ») pour qu'ils voient leurs cibles.
              </p>
            )}
          </div>
        )}
      </Bloc>

      <p className="text-xs text-muted-foreground">
        Les fichiers importés sont stockés de façon privée et ne sont lus que par la fonction d'import.
        Les chefs d'atelier se rattachent à leur site par leur nom : invitez-les depuis l'onglet Utilisateurs
        avec le rôle « Chef d'atelier » pour qu'ils accèdent à leurs cibles SAV.
      </p>
    </div>
  );
}