import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const ENTITES = ['client', 'materiel', 'rdv', 'vente', 'offre_magasin', 'badge', 'badge_obtenu', 'structure_commerciale', 'User', 'parametres_operation'];

export default function AdminDiagnostic() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [demoClients, setDemoClients] = useState(null);

  const run = async () => {
    setLoading(true);
    const res = [];
    for (const e of ENTITES) {
      try {
        const list = await base44.entities[e].list('-created_date', 500);
        res.push({ e, count: list.length, capped: list.length === 500, error: null });
        if (e === 'client') {
          setDemoClients(list.filter((c) => (c.raison_sociale || '').startsWith('DÉMO —')).length);
        }
      } catch (err) {
        res.push({ e, count: null, error: err?.message || 'erreur de lecture' });
      }
      setRows([...res]);
      await new Promise((r) => setTimeout(r, 150));
    }
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-4 w-4 text-gd-orange" /> Diagnostic des données
        </h3>
        <Button variant="ghost" size="sm" onClick={run} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Contexte utilisateur */}
      <div className="mb-3 rounded-lg bg-muted/40 p-3 text-xs">
        <p><span className="text-muted-foreground">Connecté :</span> <strong>{user?.full_name || user?.email}</strong></p>
        <p className="mt-0.5">
          <span className="text-muted-foreground">role (technique) :</span> <strong>{user?.role || '—'}</strong>
          {user?.role !== 'admin' && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-red-700">⚠ non-admin → les données filtrées par droits (RLS) sont masquées</span>}
          <span className="ml-3 text-muted-foreground">app_role :</span> <strong>{user?.app_role || '—'}</strong>
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Entité</th>
              <th className="px-3 py-2">Enregistrements visibles</th>
              <th className="px-3 py-2">Lecture</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.e} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.e}</td>
                <td className="px-3 py-2">{r.error ? '—' : `${r.count}${r.capped ? '+' : ''}`}{r.e === 'client' && demoClients != null ? ` (dont ${demoClients} démo)` : ''}</td>
                <td className="px-3 py-2">
                  {r.error
                    ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {r.error}</span>
                    : <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span>}
                </td>
              </tr>
            ))}
            {loading && rows.length < ENTITES.length && (
              <tr><td colSpan={3} className="px-3 py-3 text-center text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin" /> Lecture…</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Lecture : si tout est « OK » mais les compteurs sont à 0 → la base est vide (données non créées). Si des lectures sont en erreur →
        limite/quota Base44 ou droits. Si role ≠ admin → c'est le RLS qui masque les données.
      </p>
    </div>
  );
}
