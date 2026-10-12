import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

// Colonnes du fichier, dans l'ordre d'affichage.
const COLONNES = [
  ['date', 'Date'],
  ['heure', 'Heure'],
  ['type', 'Type de RDV'],
  ['statut', 'Statut RDV'],
  ['duree_minutes', 'Durée (min)'],
  ['client', 'Client'],
  ['siren', 'SIREN'],
  ['adresse', 'Adresse'],
  ['departement', 'Dép.'],
  ['tel_mobile', 'Mobile'],
  ['statut_client', 'Statut client'],
  ['cible_prioritaire', 'Cible prioritaire'],
  ['commercial', 'Commercial'],
  ['secteur', 'Secteur'],
  ['notes', 'Notes']
];

// Échappement CSV : guillemets doublés, champ encadré dès qu'il contient un séparateur.
const champ = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Export des rendez-vous en CSV, pour sauvegarde ou analyse hors ligne.
 * Point-virgule + BOM : le fichier s'ouvre directement dans Excel en français.
 */
export default function ExportRdv({ compact = false }) {
  const [busy, setBusy] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');

  const exporter = async (inclureAnnules) => {
    setBusy(true); setErreur(''); setResultat(null);
    try {
      const res = await base44.functions.invoke('exporter_rdv', { inclure_annules: inclureAnnules });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      const lignes = d.lignes || [];
      if (lignes.length === 0) { setErreur('Aucun rendez-vous à exporter.'); return; }

      const entete = COLONNES.map(([, libelle]) => champ(libelle)).join(';');
      const corps = lignes.map((l) => COLONNES.map(([cle]) => champ(l[cle])).join(';'));
      const csv = '﻿' + [entete, ...corps].join('\r\n');

      const horodatage = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CockpitOP_RDV_${horodatage}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResultat({ total: lignes.length });
    } catch (e) {
      setErreur(e?.response?.data?.error || e?.message || "L'export a échoué.");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <Button onClick={() => exporter(false)} disabled={busy} variant="outline"
        className="border-gd-navy text-gd-navy hover:bg-gd-navy/10">
        {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Export…</>
              : <><Download className="h-4 w-4 mr-1.5" /> Exporter les RDV</>}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
        <Download className="h-4 w-4 text-gd-orange" /> Export des rendez-vous
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Télécharge tous les rendez-vous de votre périmètre avec le client, le commercial
        et le statut. Fichier CSV prêt pour Excel — à garder comme sauvegarde.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => exporter(false)} disabled={busy}
          className="bg-gd-navy hover:bg-gd-navy-dark text-white">
          {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Export en cours…</>
                : <><Download className="h-4 w-4 mr-1.5" /> Exporter les RDV</>}
        </Button>
        <Button onClick={() => exporter(true)} disabled={busy} variant="outline"
          className="border-gd-navy/40 text-gd-navy hover:bg-gd-navy/10">
          Inclure les RDV annulés
        </Button>
      </div>

      {erreur && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erreur}
        </div>
      )}
      {resultat && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {resultat.total.toLocaleString('fr-FR')} rendez-vous exportés.
        </p>
      )}
    </div>
  );
}
