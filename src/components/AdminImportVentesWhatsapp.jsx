import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

const MACHINES = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger'];
const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];
const REPRISES = ['Sans reprise', 'Reprise NH', 'Reprise autre marque'];

const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-xs';

export default function AdminImportVentesWhatsapp({ commerciaux = [], onReload }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const commList = commerciaux.map((c) => ({ id: c.id, nom: c.full_name || c.nom || 'Commercial' }));

  const analyser = async () => {
    if (!text.trim()) return;
    setBusy(true); setError(null); setResult(null); setRows(null);
    try {
      const res = await base44.functions.invoke('importer_ventes_whatsapp', { action: 'analyser', raw_text: text });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setRows((data.ventes || []).map((v) => ({ ...v, inclure: true })));
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

  const nbInclus = (rows || []).filter((r) => r.inclure).length;

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
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Création…</> : <>Créer {nbInclus} vente(s) « À valider »</>}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result?.ok && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {result.ventes_creees} vente(s) créée(s) en « À valider ». Validez-les dans l'onglet « Ventes à valider ».
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
                <th className="p-1.5">Commercial</th>
                <th className="p-1.5">Machine</th>
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
                    <div className="mt-0.5 flex gap-1">
                      {r.confiance && <span className={`rounded px-1 ${r.confiance === 'basse' ? 'bg-red-100 text-red-700' : r.confiance === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.confiance}</span>}
                      {r.client_nom && <span className="rounded bg-slate-100 px-1 text-slate-600">{r.client_nom}</span>}
                    </div>
                  </td>
                  <td className="p-1.5">
                    <select className={selCls} value={r.commercial_id || ''} onChange={(e) => setRow(i, { commercial_id: e.target.value || null })}>
                      <option value="">{r.commercial_nom ? `? ${r.commercial_nom}` : '— non attribué —'}</option>
                      {commList.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select className={selCls} value={r.type_machine} onChange={(e) => setRow(i, { type_machine: e.target.value })}>
                      {MACHINES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select className={selCls} value={r.type_vente} onChange={(e) => setRow(i, { type_vente: e.target.value })}>
                      {TYPES_VENTE.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select className={selCls} value={r.reprise} onChange={(e) => setRow(i, { reprise: e.target.value })}>
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
