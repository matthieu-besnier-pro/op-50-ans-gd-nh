import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { TONALITES, STATUTS_DEFAUT } from '@/lib/statuts';
import { Plus, Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Lock, Loader2, Info } from 'lucide-react';

const propre = (s) => String(s || '').trim().replace(/\s+/g, ' ');

/**
 * Administration des statuts clients : ajouter, renommer, réordonner, supprimer.
 * Les statuts « automatiques » sont verrouillés : ils sont posés ou lus par l'outil
 * (prise de RDV, relances, ventes, badges), les renommer casserait ces automatismes.
 */
export default function AdminStatuts() {
  const [statuts, setStatuts] = useState([]);
  const [usages, setUsages] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNom, setEditNom] = useState('');
  const [nouveau, setNouveau] = useState({ nom: '', tonalite: 'neutre' });

  const charger = async () => {
    setLoading(true);
    try {
      const res0 = await base44.entities.statut_client.list('ordre', 200);
      let liste = Array.isArray(res0) ? res0 : (res0?.items || []);
      if (liste.length === 0) {
        await base44.entities.statut_client.bulkCreate(STATUTS_DEFAUT);
        const res1 = await base44.entities.statut_client.list('ordre', 200);
        liste = Array.isArray(res1) ? res1 : (res1?.items || []);
      }
      setStatuts(liste);
      const stats = await base44.functions.invoke('statistiques_operation', {}).catch(() => null);
      setUsages(stats?.data?.clients?.par_statut || {});
    } catch (e) {
      setErreur(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const flash = (texte) => { setMsg(texte); setTimeout(() => setMsg(''), 5000); };
  const tri = [...statuts].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const nomDejaPris = (nom, saufId) => statuts.some((s) => s.id !== saufId && s.nom.toLowerCase() === nom.toLowerCase());

  // Un changement de libellé peut concerner des milliers de clients : on traite par lots.
  const basculerClients = async (ancien, nouveau) => {
    let res = await base44.entities.client.updateMany({ statut: ancien }, { $set: { statut: nouveau } });
    let tours = 0;
    while (res?.has_more && tours < 40) {
      res = await base44.entities.client.updateMany({ statut: ancien }, { $set: { statut: nouveau } });
      tours += 1;
    }
  };

  const ajouter = async () => {
    const nom = propre(nouveau.nom);
    if (!nom) { setErreur('Indiquez un nom de statut.'); return; }
    if (nomDejaPris(nom)) { setErreur('Ce statut existe déjà.'); return; }
    setErreur(''); setBusy('new');
    try {
      const ordre = statuts.reduce((max, s) => Math.max(max, s.ordre || 0), 0) + 1;
      const cree = await base44.entities.statut_client.create({ nom, ordre, tonalite: nouveau.tonalite, systeme: false, usage: '' });
      setStatuts((l) => [...l, cree]);
      setNouveau({ nom: '', tonalite: 'neutre' });
      flash(`Statut « ${nom} » ajouté.`);
    } catch (e) {
      setErreur(e?.message || 'Ajout impossible.');
    } finally {
      setBusy(null);
    }
  };

  const renommer = async (s) => {
    const nom = propre(editNom);
    if (!nom) { setErreur('Indiquez un nom de statut.'); return; }
    if (nom === s.nom) { setEditId(null); return; }
    if (nomDejaPris(nom, s.id)) { setErreur('Ce statut existe déjà.'); return; }
    setErreur(''); setBusy(s.id);
    try {
      // Les clients portent le libellé : on les renomme tous avant le statut lui-même.
      await basculerClients(s.nom, nom);
      await base44.entities.statut_client.update(s.id, { nom });
      setStatuts((l) => l.map((x) => (x.id === s.id ? { ...x, nom } : x)));
      setEditId(null);
      flash(`« ${s.nom} » devient « ${nom} » : les clients concernés ont été mis à jour.`);
    } catch (e) {
      setErreur(e?.message || 'Renommage impossible.');
    } finally {
      setBusy(null);
    }
  };

  const supprimer = async (s) => {
    const nb = usages[s.nom] || 0;
    const remplacant = tri.find((x) => x.id !== s.id);
    if (!remplacant) { setErreur('Il doit rester au moins un statut.'); return; }
    const question = nb > 0
      ? `${nb} client(s) sont au statut « ${s.nom} ».\nIls seront remis au statut « ${remplacant.nom} », puis le statut sera supprimé.\n\nContinuer ?`
      : `Supprimer le statut « ${s.nom} » ?`;
    if (!window.confirm(question)) return;
    setErreur(''); setBusy(s.id);
    try {
      if (nb > 0) await basculerClients(s.nom, remplacant.nom);
      await base44.entities.statut_client.delete(s.id);
      setStatuts((l) => l.filter((x) => x.id !== s.id));
      flash(`Statut « ${s.nom} » supprimé.`);
    } catch (e) {
      setErreur(e?.message || 'Suppression impossible.');
    } finally {
      setBusy(null);
    }
  };

  const deplacer = async (s, delta) => {
    const i = tri.findIndex((x) => x.id === s.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= tri.length) return;
    const suite = [...tri];
    [suite[i], suite[j]] = [suite[j], suite[i]];
    const maj = suite.map((x, k) => ({ id: x.id, ordre: k + 1 }));
    setErreur(''); setBusy('ordre');
    try {
      await base44.entities.statut_client.bulkUpdate(maj);
      setStatuts((l) => l.map((x) => ({ ...x, ordre: maj.find((m) => m.id === x.id)?.ordre ?? x.ordre })));
    } catch (e) {
      setErreur(e?.message || 'Déplacement impossible.');
    } finally {
      setBusy(null);
    }
  };

  const changerTonalite = async (s, tonalite) => {
    setBusy(s.id);
    try {
      await base44.entities.statut_client.update(s.id, { tonalite });
      setStatuts((l) => l.map((x) => (x.id === s.id ? { ...x, tonalite } : x)));
    } catch (e) {
      setErreur(e?.message || 'Changement de couleur impossible.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loader compact />;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Statuts clients</h2>

      <div className="mb-4 flex gap-2 rounded-lg border border-gd-orange/30 bg-gd-orange/5 p-4 text-sm text-gd-navy">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>Renommer un statut met à jour tous les clients qui le portent.</p>
          <p className="mt-1">
            Les statuts marqués <Lock className="inline h-3 w-3" /> <span className="font-semibold">Automatique</span> sont
            posés ou lus par l'outil (prise de RDV, relances, ventes, badges) : leur nom est verrouillé et ils ne peuvent
            pas être supprimés. Les autres sont libres.
          </p>
        </div>
      </div>

      {erreur && <p className="mb-3 text-sm text-gd-red">{erreur}</p>}
      {msg && <p className="mb-3 text-sm text-emerald-600">{msg}</p>}

      <div className="divide-y divide-border rounded-lg border border-border">
        {tri.map((s, i) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => deplacer(s, -1)}
                disabled={i === 0 || busy === 'ordre'}
                title="Monter"
                className="text-muted-foreground hover:text-gd-navy disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deplacer(s, 1)}
                disabled={i === tri.length - 1 || busy === 'ordre'}
                title="Descendre"
                className="text-muted-foreground hover:text-gd-navy disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-2">
              {editId === s.id ? (
                <>
                  <Input
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') renommer(s); }}
                    className="h-9 max-w-xs"
                  />
                  <Button size="sm" onClick={() => renommer(s)} disabled={busy === s.id} className="bg-gd-navy text-white hover:bg-gd-navy-dark">
                    {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditId(null); setErreur(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <StatusBadge statut={s.nom} />
                  {s.systeme && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gd-navy/10 px-2 py-0.5 text-[11px] font-semibold text-gd-navy">
                      <Lock className="h-3 w-3" /> Automatique
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{usages[s.nom] || 0} client(s)</span>
                </>
              )}
            </div>

            <Select value={s.tonalite || 'neutre'} onValueChange={(v) => changerTonalite(s, v)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONALITES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${t.point}`} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              {s.systeme ? (
                <span className="w-[72px]" />
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Renommer"
                    onClick={() => { setErreur(''); setEditId(s.id); setEditNom(s.nom); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Supprimer"
                    onClick={() => supprimer(s)}
                    disabled={busy === s.id}
                    className="text-gd-red hover:bg-gd-red/10 hover:text-gd-red"
                  >
                    {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>

            {s.usage && (
              <p className="w-full pl-[26px] text-xs text-muted-foreground">{s.usage}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border p-4">
        <Label className="text-sm font-semibold">Ajouter un statut</Label>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Input
              placeholder="Nom du statut (ex. Rappelé le mois prochain)"
              value={nouveau.nom}
              onChange={(e) => { setErreur(''); setNouveau({ ...nouveau, nom: e.target.value }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') ajouter(); }}
            />
          </div>
          <Select value={nouveau.tonalite} onValueChange={(v) => setNouveau({ ...nouveau, tonalite: v })}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONALITES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${t.point}`} />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={ajouter} disabled={busy === 'new'} className="bg-gd-navy text-white hover:bg-gd-navy-dark">
            {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1.5" /> Ajouter</>}
          </Button>
        </div>
      </div>
    </div>
  );
}