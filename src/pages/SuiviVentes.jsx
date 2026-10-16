import React, { useMemo } from 'react';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isDirection } from '@/lib/permissions';
import { listerPartage } from '@/lib/donneesPartagees';
import { useOperationStats } from '@/lib/useOperationStats';
import { invaliderStats } from '@/lib/operationStats';
import AdminImportVentesWhatsapp from '@/components/AdminImportVentesWhatsapp';
import MachineIcone from '@/components/MachineIcone';
import MACHINES from '@/lib/famillesMachines';
import AnneauRepartition from '@/components/AnneauRepartition';
import { TrendingUp, CheckCircle2, Clock, Link2, Check, Trash2, MessageSquarePlus, ChevronUp } from 'lucide-react';

const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];
const REPRISES = ['Sans reprise', 'Reprise NH', 'Reprise autre marque'];

/**
 * Suivi des ventes — le tableau de marche de l'opération.
 *
 * Reprend la maille du suivi papier des opérations précédentes : une ligne par
 * vendeur, une colonne par type de machine, et les totaux. Les ventes viennent
 * des déclarations du groupe WhatsApp, validées ou non : on suit ce qui est
 * annoncé sur le terrain, la validation vient après.
 */

// Les comptes portent souvent pour nom l'identifiant de leur adresse
// (« jean-francois-dragon ») : on le rend lisible plutôt que de l'afficher tel
// quel dans un tableau qu'on projette et qu'on partage.
const joliNom = (v) => {
  const t = String(v || '').trim();
  if (!t || t.includes(' ')) return t;
  const mots = t.split(/[._-]+/).filter(Boolean);
  if (mots.length < 2) return t;
  const nom = mots.pop().toUpperCase();
  return `${mots.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join('-')} ${nom}`;
};



// Une répartition simple, lisible sans graphique : le libellé, la barre, le
// nombre. Sur un tableau qu'on partage largement, ça vaut mieux qu'un camembert
// qu'il faut survoler pour lire.
function Repartition({ titre, donnees, ordre }) {
  const entrees = (ordre || Object.keys(donnees || {}))
    .map((cle) => [cle, (donnees || {})[cle] || 0])
    .filter(([, n]) => n > 0);
  const total = entrees.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">{titre}</h2>
      {entrees.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <div className="space-y-2">
          {entrees.map(([cle, n]) => (
            <div key={cle}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{cle}</span>
                <span className="font-bold tabular-nums text-gd-navy">{n}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gd-navy" style={{ width: `${total > 0 ? (n / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Carte({ Icone, valeur, libelle, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">{libelle}</p>
        <Icone className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="text-3xl font-extrabold text-gd-navy-dark">{valeur}</p>
    </div>
  );
}

export default function SuiviVentes() {
  const stats = useOperationStats();
  const { user } = useAuth();
  // Tout le monde consulte ; seule la Direction corrige ou supprime — c'est
  // aussi ce que disent les règles d'accès de l'entité.
  const peutGerer = isDirection(user);
  const [structure, setStructure] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  const [sites, setSites] = React.useState([]);

  React.useEffect(() => {
    listerPartage('structure_commerciale', '-nom_commercial', 500).then(setStructure).catch(() => {});
    listerPartage('User', '-created_date', 500).then(setUsers).catch(() => {});
    // Le tableau de répartition nomme TOUS les commerciaux de la société, y
    // compris ceux qui n'ont jamais ouvert l'outil.
    listerPartage('base', 'nom', 500).then(setSites).catch(() => {});
  }, []);

  // Nom affichable d'un vendeur : son compte, sinon sa fiche de secteur.
  const nomPar = useMemo(() => {
    const m = {};
    // Le nom du compte d'abord, puis celui de la fiche de secteur, qui est le
    // plus propre quand elle existe.
    (users || []).forEach((u) => { if (u.full_name) m[u.id] = joliNom(u.full_name); });
    (structure || []).forEach((f) => { if (f.user_id && f.nom_commercial) m[f.user_id] = f.nom_commercial; });
    return m;
  }, [structure, users]);

  const suivi = stats?.ventes?.suivi || null;

  // Les vendeurs proposés à l'import : leur nom de secteur, bien plus lisible
  // que le nom de compte, qui vaut souvent l'identifiant de l'adresse.
  const commerciauxListe = useMemo(() => {
    const parId = new Map();
    (structure || []).forEach((f) => {
      if (f.user_id && f.nom_commercial) parId.set(f.user_id, f.nom_commercial);
    });
    // Un vendeur peut ne PAS figurer dans la structure commerciale — il n'était
    // pas du phoning — et vendre malgré tout. Son compte suffit à le proposer :
    // sinon sa vente n'a personne à qui être attribuée.
    const vendeurs = ['commercial', 'agri_precision', 'commercial_chef_atelier', 'responsable', 'direction'];
    (users || []).forEach((u) => {
      if (parId.has(u.id) || !vendeurs.includes(u.app_role || '')) return;
      parId.set(u.id, joliNom(u.full_name || u.email || '') || 'Vendeur');
    });

    const avecCompte = [...parId.entries()].map(([id, nom]) => ({ id, nom }));

    // Et ceux du tableau de répartition qui n'ont pas de compte : ils vendent
    // sans s'être jamais connectés. Leur vente est enregistrée à leur NOM,
    // plutôt que perdue faute de les trouver dans la liste.
    const cle = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ');
    const connus = new Set(avecCompte.map((c) => cle(c.nom)));
    const sansCompte = [...new Set((sites || []).flatMap((b) => b.commerciaux || []).filter(Boolean))]
      .filter((nom) => !connus.has(cle(nom)))
      .map((nom) => ({ id: `nom:${nom}`, nom, sansCompte: true }));

    return [...avecCompte, ...sansCompte].sort((a, b) => a.nom.localeCompare(b.nom));
  }, [structure, users, sites]);

  // Les déclarations vivent en état local : une correction doit se voir tout de
  // suite, sans attendre le prochain calcul serveur.
  const [declarations, setDeclarations] = React.useState(null);
  const [filtre, setFiltre] = React.useState('toutes');
  const [enCours, setEnCours] = React.useState(null);

  React.useEffect(() => {
    if (suivi?.declarations) setDeclarations(suivi.declarations);
  }, [suivi?.declarations]);

  const majVente = async (id, champs) => {
    setEnCours(id);
    try {
      await base44.entities.vente.update(id, champs);
      setDeclarations((l) => (l || []).map((d) => (d.id === id ? { ...d, ...champs, machine: champs.type_machine ?? d.machine, validee: champs.statut_validation ? champs.statut_validation === 'Validé' : d.validee } : d)));
      invaliderStats(); // le croisement du haut doit suivre
    } catch (e) {
      window.alert("Modification impossible : " + (e?.message || 'droits insuffisants'));
    } finally {
      setEnCours(null);
    }
  };

  const supprimerVente = async (d) => {
    if (!window.confirm(`Supprimer définitivement cette vente ${d.machine || ''} ${d.client ? '— ' + d.client : ''} ?`)) return;
    setEnCours(d.id);
    try {
      await base44.entities.vente.delete(d.id);
      setDeclarations((l) => (l || []).filter((x) => x.id !== d.id));
      invaliderStats();
    } catch (e) {
      window.alert('Suppression impossible : ' + (e?.message || 'droits insuffisants'));
    } finally {
      setEnCours(null);
    }
  };

  // Dix déclarations suffisent à voir ce qui se passe ; le reste se déplie.
  const [toutVoir, setToutVoir] = React.useState(false);
  const retenues = (declarations || []).filter((d) =>
    filtre === 'toutes' || (filtre === 'validees' ? d.validee : !d.validee));
  const visibles = toutVoir ? retenues : retenues.slice(0, 10);

  const [importOuvert, setImportOuvert] = React.useState(false);
  const [copie, setCopie] = React.useState(false);
  const copierLien = () => {
    // Le lien partagé est le PUBLIC : celui qui le reçoit n'a pas de compte.
    const lien = `${window.location.origin}/ventes`;
    const fini = () => { setCopie(true); setTimeout(() => setCopie(false), 2500); };
    // Le presse-papier est refusé hors contexte sécurisé : on retombe alors sur
    // une sélection, plutôt que de ne rien faire sans rien dire.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(lien).then(fini).catch(() => window.prompt('Lien à partager :', lien));
    } else {
      window.prompt('Lien à partager :', lien);
    }
  };

  const lignes = useMemo(() => {
    const par = suivi?.par_commercial || {};
    return Object.entries(par)
      .map(([id, v]) => ({
        id,
        // Clé « nom:… » : un vendeur sans compte, déclaré par son nom.
        nom: nomPar[id] || v.nom || (String(id).startsWith('nom:') ? id.slice(4) : `Vendeur ${String(id).slice(-4)}`),
        machines: v.machines || {},
        total: v.total || 0,
        validees: v.validees || 0
      }))
      .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom));
  }, [suivi, nomPar]);

  const totauxMachines = suivi?.par_machine || {};
  // Deux univers distincts : le matériel d'un côté, l'agri. précision de l'autre.
  const ventesAgri = totauxMachines['Agri. précision'] || 0;
  const ventesMateriel = Math.max((suivi?.total || 0) - ventesAgri, 0);
  // Un type de machine absent de la liste historique — un outil, un kit — ne
  // doit pas disparaître du total : on le regroupe sous « Autre ».
  const connus = new Set(MACHINES.map((m) => m.cle));
  const autres = Object.entries(totauxMachines)
    .filter(([k]) => !connus.has(k))
    .reduce((s, [, n]) => s + n, 0);

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gd-navy-dark">Suivi des ventes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Déclarations du groupe WhatsApp, par vendeur et par type de machine.
            Le lien de partage ouvre une version publique, consultable sans compte.
          </p>
        </div>
        {/* Le lien se copie plutôt qu'il ne se dicte : l'adresse est longue, et
            tout le monde n'a pas l'outil déjà ouvert. */}
        <div className="flex shrink-0 flex-wrap gap-2">
        {peutGerer && (
          <button
            type="button"
            onClick={() => setImportOuvert((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gd-orange px-3 py-2 text-xs font-bold uppercase tracking-wider text-gd-navy-dark transition-colors hover:bg-gd-orange/90"
          >
            {importOuvert ? <><ChevronUp className="h-4 w-4" /> Fermer</> : <><MessageSquarePlus className="h-4 w-4" /> Déclarer des ventes</>}
          </button>
        )}
        <button
          type="button"
          onClick={copierLien}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gd-navy/30 px-3 py-2 text-xs font-semibold text-gd-navy transition-colors hover:bg-gd-navy/5"
        >
          {copie ? <><Check className="h-4 w-4 text-emerald-600" /> Lien copié</> : <><Link2 className="h-4 w-4" /> Copier le lien de partage</>}
        </button>
        </div>
      </div>

      {/* Tout ce qui touche aux ventes se fait ici : déclarer, relire, corriger.
          Plus besoin de passer par l'Administration. */}
      {peutGerer && importOuvert && (
        <div className="mb-6 rounded-xl border border-gd-orange/40 bg-gd-orange/5 p-4">
          <AdminImportVentesWhatsapp commerciaux={commerciauxListe} onReload={invaliderStats} />
        </div>
      )}

      {!stats ? (
        <Loader />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Carte Icone={TrendingUp} valeur={suivi?.total ?? 0} libelle="Ventes déclarées" accent="text-gd-orange" />
            <Carte Icone={CheckCircle2} valeur={suivi?.validees ?? 0} libelle="Validées" accent="text-emerald-600" />
            <Carte
              Icone={Clock}
              valeur={Math.max((suivi?.total ?? 0) - (suivi?.validees ?? 0), 0)}
              libelle="En attente de validation"
              accent="text-muted-foreground"
            />
          </div>

          {/* Le rapport des ventes aux rendez-vous, chaque univers avec le sien :
              rapporter des ventes de matériel à des rendez-vous d'agri. précision
              n'aurait aucun sens. */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { famille: 'Tracteur', titre: 'Matériel', ventes: ventesMateriel, rdv: suivi?.rdv?.materiel || 0 },
              { famille: 'Agri. précision', titre: 'Agri. précision', ventes: ventesAgri, rdv: suivi?.rdv?.agri || 0 }
            ].map((u) => {
              const taux = u.rdv > 0 ? Math.round((u.ventes / u.rdv) * 100) : 0;
              return (
                <div key={u.titre} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
                      <MachineIcone famille={u.famille} titre={u.titre} className="h-8 w-12 text-gd-navy" />
                      {u.titre}
                    </h2>
                    <span className="text-2xl font-extrabold tabular-nums text-gd-orange">{taux}%</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-bold text-gd-navy-dark">{u.ventes}</span> vente{u.ventes > 1 ? 's' : ''}
                    {' pour '}
                    <span className="font-bold text-gd-navy-dark">{u.rdv}</span> rendez-vous
                    {' — taux de transformation'}
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gd-orange" style={{ width: `${Math.min(taux, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Le parc vendu d'un coup d'œil : un picto, un chiffre. C'est ce que
              le suivi papier faisait avec ses vignettes, en plus lisible. */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {MACHINES.map((m) => {
              const n = totauxMachines[m.cle] || 0;
              return (
                <div
                  key={m.cle}
                  title={m.libelle}
                  className={`rounded-xl border p-3 text-center transition-colors ${
                    n > 0 ? 'border-gd-orange/40 bg-gd-orange/5' : 'border-border bg-card'
                  }`}
                >
                  <MachineIcone
                    famille={m.cle}
                    titre={m.libelle}
                    className={`mx-auto h-14 w-full ${n > 0 ? 'text-gd-navy' : 'text-muted-foreground/40'} ${n > 0 ? '' : 'opacity-50 grayscale'}`}
                  />
                  <p className={`mt-1.5 text-2xl font-extrabold tabular-nums ${n > 0 ? 'text-gd-navy-dark' : 'text-muted-foreground/40'}`}>
                    {n}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                    {m.libelle}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vendeur
                  </th>
                  {MACHINES.map((m) => (
                    <th key={m.cle} className="px-3 py-2 text-center align-bottom">
                      <MachineIcone famille={m.cle} titre={m.libelle} className="mx-auto h-9 w-16 text-gd-navy" />
                      <span className="mx-auto mt-1 block max-w-[5.5rem] text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                        {m.libelle}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td colSpan={MACHINES.length + 2} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Aucune vente déclarée pour l'instant.
                    </td>
                  </tr>
                ) : (
                  lignes.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm">
                        <span className="font-semibold text-foreground">{l.nom}</span>
                        {l.validees < l.total && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {l.validees} validée{l.validees > 1 ? 's' : ''} sur {l.total}
                          </span>
                        )}
                      </td>
                      {MACHINES.map((m) => {
                        const n = l.machines[m.cle] || 0;
                        return (
                          <td key={m.cle} className="px-3 py-3 text-center">
                            {n > 0 ? (
                              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-gd-navy px-2 text-sm font-bold tabular-nums text-white">
                                {n}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-gd-navy">
                        {l.total}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lignes.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/50">
                    <td className="px-4 py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Total
                    </td>
                    {MACHINES.map((m) => (
                      <td key={m.cle} className="px-3 py-3 text-center text-sm font-extrabold tabular-nums text-gd-navy-dark">
                        {totauxMachines[m.cle] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-gd-navy-dark">
                      {suivi?.total ?? 0}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Repartition
              titre="Répartition des ventes"
              donnees={suivi?.par_type_vente}
              ordre={['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris', 'Non précisé']}
            />
            {/* Par MARQUE : savoir qui l'on reprend vaut mieux que de savoir
                qu'on reprend. « Sans reprise » reste une part à part entière. */}
            <AnneauRepartition
              titre="Reprises par marque"
              donnees={suivi?.par_marque_reprise}
              vide="Aucune reprise déclarée."
            />
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
                Déclarations de vente
                <span className="ml-2 font-normal normal-case text-muted-foreground">{retenues.length}</span>
              </h2>
              <div className="flex gap-1">
                {[
                  { cle: 'toutes', libelle: 'Toutes' },
                  { cle: 'validees', libelle: 'Validées' },
                  { cle: 'attente', libelle: 'À valider' }
                ].map((f) => (
                  <button
                    key={f.cle}
                    type="button"
                    onClick={() => setFiltre(f.cle)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      filtre === f.cle ? 'bg-gd-navy text-white' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f.libelle}
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Vendeur</th>
                  <th className="px-4 py-2 text-left font-semibold">Client</th>
                  <th className="px-4 py-2 text-left font-semibold">Machine</th>
                  <th className="px-4 py-2 text-left font-semibold">Modèle</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Reprise</th>
                  <th className="px-4 py-2 text-left font-semibold">État</th>
                  {peutGerer && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan={peutGerer ? 9 : 8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Aucune déclaration à afficher.
                    </td>
                  </tr>
                ) : (
                  visibles.map((d) => {
                    const fige = enCours === d.id;
                    const sel = 'rounded border border-border bg-background px-1.5 py-1 text-sm';
                    return (
                      <tr key={d.id} className={`border-b border-border last:border-0 text-sm hover:bg-muted/30 ${fige ? 'opacity-50' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                          {d.date ? d.date.split('-').reverse().join('/') : '—'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-foreground">{nomPar[d.commercial_id] || d.vendeur || '—'}</td>
                        <td className="px-4 py-2 text-foreground">{d.client || '—'}</td>
                        {/* La Direction corrige sur place : une déclaration mal
                            rangée se répare en deux clics, sans quitter la page. */}
                        <td className="px-4 py-2">
                          {peutGerer ? (
                            <select className={sel} value={d.machine || ''} disabled={fige}
                              onChange={(e) => majVente(d.id, { type_machine: e.target.value })}>
                              <option value="">— à préciser —</option>
                              {MACHINES.map((m) => <option key={m.cle} value={m.cle}>{m.libelle}</option>)}
                            </select>
                          ) : (d.machine || '—')}
                        </td>
                        {/* Le modèle : c'est lui que les équipes reconnaissent,
                            bien plus que la famille. Corrigeable sur place. */}
                        <td className="px-4 py-2">
                          {peutGerer ? (
                            <input
                              className={`${sel} w-24`}
                              defaultValue={d.modele || ''}
                              placeholder="T6.160"
                              disabled={fige}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val !== (d.modele || '')) majVente(d.id, { modele: val });
                              }}
                            />
                          ) : (
                            <span className="font-semibold text-gd-navy">{d.modele || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {peutGerer ? (
                            <select className={sel} value={d.type_vente || ''} disabled={fige}
                              onChange={(e) => majVente(d.id, { type_vente: e.target.value })}>
                              <option value="">— à préciser —</option>
                              {TYPES_VENTE.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : (d.type_vente || '—')}
                        </td>
                        <td className="px-4 py-2">
                          {peutGerer ? (
                            <select className={sel} value={d.reprise || ''} disabled={fige}
                              onChange={(e) => majVente(d.id, { reprise: e.target.value })}>
                              <option value="">— à préciser —</option>
                              {REPRISES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : (
                            <>{d.reprise || '—'}{d.marque_reprise ? ` · ${d.marque_reprise}` : ''}</>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {d.validee ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Validée</span>
                          ) : peutGerer ? (
                            <button type="button" disabled={fige}
                              onClick={() => majVente(d.id, { statut_validation: 'Validé' })}
                              className="rounded-full bg-gd-orange/20 px-2 py-0.5 text-xs font-semibold text-gd-navy-dark hover:bg-gd-orange/30">
                              Valider
                            </button>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">À valider</span>
                          )}
                        </td>
                        {peutGerer && (
                          <td className="px-4 py-2 text-right">
                            <button type="button" disabled={fige} onClick={() => supprimerVente(d)}
                              title="Supprimer cette déclaration"
                              className="text-muted-foreground transition-colors hover:text-gd-red">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {retenues.length > 10 && (
              <button
                type="button"
                onClick={() => setToutVoir((v) => !v)}
                className="w-full border-t border-border py-3 text-sm font-semibold text-gd-navy transition-colors hover:bg-muted/50"
              >
                {toutVoir ? 'Réduire' : `Voir la suite (${retenues.length - 10})`}
              </button>
            )}
          </div>

          {autres > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {autres} vente{autres > 1 ? 's' : ''} portent sur un matériel hors de ces sept familles
              (outil, kit, équipement). Elles comptent dans le total mais n'ont pas de colonne.
            </p>
          )}
        </>
      )}
    </Layout>
  );
}
