import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { listerPartage } from '@/lib/donneesPartagees';
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

const COLONNES_CLIENTS = [
  ['client', 'Client'],
  ['siren', 'SIREN'],
  ['statut', 'Statut'],
  ['date_dernier_contact', 'Dernier contact'],
  ['date_rappel', 'À rappeler le'],
  ['motif_refus', 'Motif de refus'],
  ['montant_devis', 'Montant devis'],
  ['nb_tentatives', 'Tentatives'],
  ['nb_rdv', 'Nb RDV'],
  ['prochain_rdv', 'Prochain RDV'],
  ['cible_prioritaire', 'Cible prioritaire'],
  ['commercial', 'Commercial'],
  ['secteur', 'Secteur'],
  ['departement', 'Dép.'],
  ['adresse', 'Adresse'],
  ['tel_mobile', 'Mobile'],
  ['parc_total', 'Machines'],
  ['usages', 'Usages'],
  ['agri_precision', 'Agri. précision']
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
  // Statuts disponibles : la liste est administrée dans Administration → Statuts,
  // on la relit plutôt que de la figer ici.
  const [statuts, setStatuts] = useState([]);
  const [choix, setChoix] = useState([]);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    listerPartage('statut_client', 'ordre', 100)
      .then((l) => setStatuts((l || []).map((st) => st.nom).filter(Boolean)))
      .catch(() => setStatuts([]));
  }, []);

  const basculer = (nom) =>
    setChoix((c) => (c.includes(nom) ? c.filter((x) => x !== nom) : [...c, nom]));

  // Un seul générateur pour les deux exports : fonction serveur → CSV → téléchargement.
  const telecharger = async ({ fonction, args, colonnes, prefixe, quoi, vide }) => {
    setBusy(true); setErreur(''); setResultat(null);
    try {
      const res = await base44.functions.invoke(fonction, args);
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      const lignes = d.lignes || [];
      if (lignes.length === 0) { setErreur(vide); return; }

      const entete = colonnes.map(([, libelle]) => champ(libelle)).join(';');
      const corps = lignes.map((l) => colonnes.map(([cle]) => champ(l[cle])).join(';'));
      // BOM UTF-8 : Excel ouvre le fichier avec les bons accents.
      const csv = '\uFEFF' + [entete, ...corps].join('\r\n');

      const horodatage = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CockpitOP_${prefixe}_${horodatage}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResultat({ total: lignes.length, quoi });
    } catch (e) {
      setErreur(e?.response?.data?.error || e?.message || "L'export a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const exporter = (inclureAnnules) => telecharger({
    fonction: 'exporter_rdv',
    args: { inclure_annules: inclureAnnules },
    colonnes: COLONNES,
    prefixe: 'RDV',
    quoi: 'rendez-vous',
    vide: 'Aucun rendez-vous à exporter.'
  });

  // Export d'une sélection précise de statuts.
  const exporterStatuts = () => telecharger({
    fonction: 'exporter_clients',
    args: { statuts: choix },
    colonnes: COLONNES_CLIENTS,
    prefixe: 'Clients_statuts',
    quoi: 'client(s)',
    vide: 'Aucun client avec ces statuts.'
  });

  const exporterClients = (tous) => telecharger({
    fonction: 'exporter_clients',
    args: { tous },
    colonnes: COLONNES_CLIENTS,
    prefixe: tous ? 'Clients' : 'Clients_contactes',
    quoi: 'client(s)',
    vide: tous ? 'Aucun client à exporter.' : "Aucun client contacté pour l'instant."
  });

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
        Sauvegardes complémentaires : les <strong>rendez-vous</strong> pris, et les
        <strong>clients travaillés</strong> — tous les statuts sauf « À contacter », avec la
        suite donnée. Un choix statut par statut est disponible plus bas. Fichiers CSV
        prêts pour Excel.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => exporter(false)} disabled={busy}
          className="bg-gd-navy hover:bg-gd-navy-dark text-white">
          {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Export en cours…</>
                : <><Download className="h-4 w-4 mr-1.5" /> Exporter les RDV</>}
        </Button>
        <Button onClick={() => exporter(true)} disabled={busy} variant="outline"
          className="border-gd-navy/40 text-gd-navy hover:bg-gd-navy/10">
          RDV + annulés
        </Button>
        <Button onClick={() => exporterClients(false)} disabled={busy}
          className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark font-semibold">
          <Download className="h-4 w-4 mr-1.5" /> Clients travaillés — tous sauf « À contacter »
        </Button>
        <Button onClick={() => exporterClients(true)} disabled={busy} variant="outline"
          className="border-gd-orange/50 text-gd-navy hover:bg-gd-orange/10">
          Tous les clients
        </Button>
      </div>

      {statuts.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            className="text-xs font-bold uppercase tracking-wider text-gd-navy hover:text-gd-orange"
          >
            {ouvert ? '▾' : '▸'} Choisir les statuts à exporter
          </button>
          {ouvert && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {statuts.map((nom) => {
                  const actif = choix.includes(nom);
                  return (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => basculer(nom)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        actif
                          ? 'border-gd-orange bg-gd-orange/15 text-gd-navy-dark'
                          : 'border-border text-muted-foreground hover:border-gd-navy/40'
                      }`}
                    >
                      {actif ? '✓ ' : ''}{nom}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  onClick={exporterStatuts}
                  disabled={busy || choix.length === 0}
                  className="bg-gd-navy hover:bg-gd-navy-dark text-white"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Exporter la sélection{choix.length > 0 ? ` (${choix.length})` : ''}
                </Button>
                <button
                  type="button"
                  onClick={() => setChoix(statuts.filter((n) => n !== 'À contacter'))}
                  className="text-xs text-gd-navy underline hover:text-gd-orange"
                >
                  Tout sauf « À contacter »
                </button>
                <button
                  type="button"
                  onClick={() => setChoix([])}
                  className="text-xs text-muted-foreground underline hover:text-gd-navy"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {erreur && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erreur}
        </div>
      )}
      {resultat && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {resultat.total.toLocaleString('fr-FR')} {resultat.quoi} exporté(s).
        </p>
      )}
    </div>
  );
}
