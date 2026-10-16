import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

const MACHINES = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger', 'Agri. précision'];
const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];
const REPRISES = ['Sans reprise', 'Reprise NH', 'Reprise autre marque'];

const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-xs';

export default function AdminImportVentesWhatsapp({ commerciaux = [], onReload }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Un identifiant préfixé « nom: » désigne un vendeur SANS compte : la vente
  // est alors enregistrée à son nom. Sans cela, un vendeur jamais connecté
  // n'existe pas pour l'outil, et sa déclaration reste bloquée.
  const commList = commerciaux.map((c) => ({
    id: c.id,
    nom: c.full_name || c.nom || 'Commercial',
    sansCompte: Boolean(c.sansCompte) || String(c.id || '').startsWith('nom:')
  }));
  const choisirVendeur = (i, valeur) => setRow(i, valeur.startsWith('nom:')
    ? { commercial_id: null, commercial_nom: valeur.slice(4) }
    : { commercial_id: valeur || null, commercial_nom: '' });

  const analyser = async () => {
    if (!text.trim()) return;
    setBusy(true); setError(null); setResult(null); setRows(null);
    try {
      const res = await base44.functions.invoke('importer_ventes_whatsapp', { action: 'analyser', raw_text: text });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      // Le serveur a déjà décoché ce qui sort de l'opération : on respecte son
      // choix plutôt que de tout cocher.
      setRows((data.ventes || []).map((v) => ({ ...v, inclure: v.inclure !== false })));
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => setRows((rs) => rs.filter((_, j) => j !== i));

  const creer = async () => {
    const sales = (rows || []).filter((r) => r.inclure);
    if (sales.length === 0) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke('importer_ventes_whatsapp', { action: 'creer', sales });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setRows(null); setText('');
      onReload?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  // Une ligne ne peut être créée que complète : rien n'est deviné à sa place.
  const manquants = (r) => [
    !r.commercial_id && !r.commercial_nom && 'vendeur',
    !r.type_machine && 'machine',
    !r.type_vente && 'type',
    !r.reprise && 'reprise'
  ].filter(Boolean);
  const nbIncompletes = (rows || []).filter((r) => r.inclure && manquants(r).length > 0).length;

  const nbInclus = (rows || []).filter((r) => r.inclure).length;
  // Le bouton annonce des VENTES, pas des messages : « 2 x T6.180 » en fait deux.
  const nbVentes = (rows || []).filter((r) => r.inclure && manquants(r).length === 0)
    .reduce((s, r) => s + Math.max(1, Number(r.quantite) || 1), 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <MessageSquare className="h-4 w-4 text-gd-orange" /> Import des ventes WhatsApp
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Collez les messages du groupe WhatsApp du jour. L'IA extrait les ventes ; vous vérifiez, puis créez en « À valider ».
        Les commerciaux ne ressaisissent rien.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Collez ici les messages WhatsApp (copier-coller de la conversation)…"
        className="w-full rounded-lg border border-border bg-background p-3 text-sm"
      />

      <div className="mt-3 flex gap-3">
        <Button onClick={analyser} disabled={busy || !text.trim()}
          className="bg-gd-navy hover:bg-gd-navy-dark text-white">
          {busy && !rows ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Analyse…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Analyser</>}
        </Button>
        {rows && rows.length > 0 && (
          <Button onClick={creer} disabled={busy || nbInclus === 0}
            className="bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark">
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Création…</> : <>Créer {nbVentes} vente(s) « À valider »</>}
          </Button>
        )}
        {nbIncompletes > 0 && (
          <span className="text-xs font-semibold text-gd-navy-dark">
            {nbIncompletes} ligne{nbIncompletes > 1 ? 's' : ''} à compléter — elles ne seront pas créées tant qu'il manque un champ.
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result?.ok && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {result.ventes_creees} vente(s) créée(s) en « À valider ».
            {' '}Validez-les sur la page <strong>Suivi des ventes</strong>, où elles s'affichent avec le reste.
            {result.incompletes > 0 && (
              <> {result.incompletes} ligne(s) n'ont pas été créées : il leur manquait un champ.</>
            )}
          </span>
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Aucune vente détectée dans ce texte.</div>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-1.5"><input type="checkbox" checked={nbInclus === rows.length} onChange={(e) => setRows(rows.map((r) => ({ ...r, inclure: e.target.checked })))} /></th>
                <th className="p-1.5">Message</th>
                <th className="p-1.5">Vendeur</th>
                <th className="p-1.5">Client</th>
                <th className="p-1.5">Machine</th>
                <th className="p-1.5">Modèle</th>
                <th className="p-1.5">Qté</th>
                <th className="p-1.5">Type</th>
                <th className="p-1.5">Reprise</th>
                <th className="p-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="p-1.5"><input type="checkbox" checked={r.inclure} onChange={(e) => setRow(i, { inclure: e.target.checked })} /></td>
                  <td className="p-1.5 max-w-[220px]">
                    <div className="text-foreground">{r.texte_source || <span className="text-muted-foreground">—</span>}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {/* Heure lue dans le préfixe du message. Affichée avant
                          validation : si le préfixe manquait, la ligne le dit
                          plutôt que de prendre l'heure de l'import en silence. */}
                      {r.declare_le ? (
                        <span className="rounded bg-gd-navy/10 px-1 font-semibold tabular-nums text-gd-navy">
                          {r.declare_le.slice(8, 10)}/{r.declare_le.slice(5, 7)} à {r.declare_le.slice(11, 13)}h{r.declare_le.slice(14, 16)}
                        </span>
                      ) : (
                        <span className="rounded bg-gd-orange/20 px-1 font-semibold text-gd-navy-dark">heure non détectée</span>
                      )}
                      {r.confiance && <span className={`rounded px-1 ${r.confiance === 'basse' ? 'bg-red-100 text-red-700' : r.confiance === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.confiance}</span>}
                      {/* Matériel étranger à l'opération New Holland : la ligne
                          reste visible, décochée, pour qu'on puisse la rattraper. */}
                      {r.hors_operation && <span className="rounded bg-slate-200 px-1 font-semibold text-slate-700">hors opération</span>}
                      {r.inclure && manquants(r).length > 0 && (
                        <span className="rounded bg-gd-orange/20 px-1 font-semibold text-gd-navy-dark">
                          à compléter : {manquants(r).join(', ')}
                        </span>
                      )}

                    </div>
                  </td>
                  <td className="p-1.5">
                    <select
                      className={`${selCls} ${r.commercial_id || r.commercial_nom ? '' : 'border-gd-orange bg-gd-orange/5'}`}
                      value={r.commercial_id || (r.commercial_nom ? `nom:${r.commercial_nom}` : '')}
                      onChange={(e) => choisirVendeur(i, e.target.value)}
                    >
                      <option value="">— à préciser —</option>
                      {commList.map((c) => (
                        <option key={c.id} value={c.id}>{c.nom}{c.sansCompte ? ' (sans compte)' : ''}</option>
                      ))}
                    </select>
                  </td>
                  {/* Le client détecté est corrigeable : c'est lui qu'on relit en
                      premier avant de valider, et l'IA le rate plus souvent que
                      le reste — nom abrégé, orthographe libre. */}
                  <td className="p-1.5">
                    <input
                      className={`${selCls} min-w-[130px]`}
                      value={r.client_nom || ''}
                      placeholder="— non détecté —"
                      onChange={(e) => setRow(i, { client_nom: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      className={`${selCls} ${r.type_machine ? '' : 'border-gd-orange bg-gd-orange/5'}`}
                      value={r.type_machine || ''}
                      onChange={(e) => setRow(i, { type_machine: e.target.value })}
                    >
                      <option value="">— à préciser —</option>
                      {MACHINES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  {/* Le modèle tel qu'annoncé : c'est ce que les équipes
                      reconnaissent, bien plus qu'une famille. */}
                  <td className="p-1.5">
                    <input
                      className={`${selCls} w-24`}
                      value={r.modele || ''}
                      placeholder="T6.160"
                      onChange={(e) => setRow(i, { modele: e.target.value })}
                    />
                  </td>
                  {/* « Vendu 2 x T6.180 » : deux machines, donc deux ventes. */}
                  <td className="p-1.5">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      className={`${selCls} w-14`}
                      value={r.quantite || 1}
                      onChange={(e) => setRow(i, { quantite: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      className={`${selCls} ${r.type_vente ? '' : 'border-gd-orange bg-gd-orange/5'}`}
                      value={r.type_vente || ''}
                      onChange={(e) => setRow(i, { type_vente: e.target.value })}
                    >
                      <option value="">— à préciser —</option>
                      {TYPES_VENTE.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select
                      className={`${selCls} ${r.reprise ? '' : 'border-gd-orange bg-gd-orange/5'}`}
                      value={r.reprise || ''}
                      onChange={(e) => setRow(i, { reprise: e.target.value })}
                    >
                      <option value="">— à préciser —</option>
                      {REPRISES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {r.reprise === 'Reprise autre marque' && (
                      <input value={r.marque_reprise || ''} onChange={(e) => setRow(i, { marque_reprise: e.target.value })}
                        placeholder="Marque" className="mt-1 h-7 w-full rounded-md border border-border bg-background px-2 text-xs" />
                    )}
                  </td>
                  <td className="p-1.5">
                    <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Le client peut rester vide : la vente compte quand même dans le tableau de bord. Vous pourrez la rattacher à un client lors de la validation.</p>
        </div>
      )}
    </div>
  );
}
