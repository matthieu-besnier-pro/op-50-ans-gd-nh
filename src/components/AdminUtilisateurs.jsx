import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { UserPlus, Trash2, Search, CheckCircle2, CircleDashed, X } from 'lucide-react';

const ROLES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'commercial_chef_atelier', label: "Chef d'atelier + Commercial" },
  { value: 'agri_precision', label: 'Agriculture de précision' },
  { value: 'responsable', label: 'Responsable commercial' },
  { value: 'chef_atelier', label: "Chef d'atelier" },
  { value: 'responsable_sav', label: 'Responsable SAV' },
  { value: 'direction', label: 'Direction / Marketing' },
  { value: 'collaborateur', label: 'Collaborateur' }
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const SECONDS = [
  { value: 'aucun', label: '—' },
  { value: 'agri_precision', label: 'Agriculture de précision' },
  { value: 'responsable_sav', label: 'Responsable SAV' },
  { value: 'chef_atelier', label: "Chef d'atelier" },
  { value: 'responsable', label: 'Responsable commercial' },
  { value: 'commercial', label: 'Commercial' }
];

const BASES_ROLES = ['commercial', 'commercial_chef_atelier', 'responsable', 'chef_atelier', 'responsable_sav'];

// Clé de nom insensible à l'ordre prénom/nom et aux accents : « DRAGON Jean-Francois »
// et « Jean-Francois DRAGON » désignent la même personne.
const cleNom = (v) => String(v || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
  .split(' ').filter(Boolean).sort().join(' ');

const clesCompte = (u) => [
  cleNom(u.full_name),
  cleNom(String(u.email || '').split('@')[0].replace(/[._-]+/g, ' '))
].filter(Boolean);

// Toutes les personnes de l'opération, qu'elles aient un compte ou non :
//   — les comptes créés (rôle, seconde casquette, base),
//   — les fiches commerciales sans compte (elles portent des clients et des ventes),
//   — les référents d'atelier nommés sur un site sans compte.
// Une fiche retrouvée par son nom ou son email se range derrière son compte :
// on ne veut pas deux lignes pour la même personne.
export default function AdminUtilisateurs({ bases = [], onReload }) {
  const [users, setUsers] = useState([]);
  const [fiches, setFiches] = useState([]);
  const [sites, setSites] = useState(bases);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [msg, setMsg] = useState('');
  const [invite, setInvite] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [res, st, bs] = await Promise.all([
        base44.functions.invoke('lister_utilisateurs', {}).catch(() => ({ data: { users: [] } })),
        base44.entities.structure_commerciale.list('-nom_commercial', 300),
        base44.entities.base.list('-nom', 100)
      ]);
      setUsers(res?.data?.users || []);
      setFiches(st || []);
      setSites(bs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const flash = (texte) => { setMsg(texte); setTimeout(() => setMsg(''), 5000); };

  const lignes = useMemo(() => {
    const out = [];
    const fichesPrises = new Set();

    users.forEach((u) => {
      const cles = clesCompte(u);
      const fiche = fiches.find((f) => !fichesPrises.has(f.id) && (
        f.user_id === u.id
        || (f.email && u.email && f.email.toLowerCase() === u.email.toLowerCase())
        || cles.includes(cleNom(f.nom_commercial))
      ));
      if (fiche) fichesPrises.add(fiche.id);
      out.push({
        kind: 'compte',
        id: u.id,
        nom: u.full_name || u.email,
        email: u.email || '',
        app_role: u.app_role || 'collaborateur',
        secondaire: u.app_role_secondaire || '',
        base_id: u.base_id || '',
        fiche
      });
    });

    fiches.filter((f) => !fichesPrises.has(f.id)).forEach((f) => {
      out.push({
        kind: 'fiche',
        id: f.id,
        nom: f.nom_commercial,
        email: f.email || '',
        fiche: f
      });
    });

    const referents = new Map();
    sites.forEach((b) => {
      (b.chefs_atelier || []).forEach((n) => referents.set(`chefs_atelier|${n}`, { nom: n, fonction: "Chef d'atelier", champ: 'chefs_atelier', baseId: b.id, site: b.nom }));
      (b.responsables_sav || []).forEach((n) => referents.set(`responsables_sav|${n}`, { nom: n, fonction: 'Responsable SAV', champ: 'responsables_sav', baseId: b.id, site: b.nom }));
    });
    referents.forEach((r) => {
      const dejaCompte = out.some((l) => l.kind === 'compte' && clesCompte({ full_name: l.nom, email: l.email }).includes(cleNom(r.nom)));
      if (!dejaCompte) out.push({ kind: 'referent', id: `${r.champ}|${r.nom}`, ...r });
    });

    return out.sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
  }, [users, fiches, sites]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter((l) => {
      if (filtre === 'compte' && l.kind !== 'compte') return false;
      if (filtre === 'sans' && l.kind === 'compte') return false;
      if (!q) return true;
      return [l.nom, l.email, l.site, l.fiche?.entite, l.fiche?.manager, ROLE_LABEL[l.app_role]]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [lignes, filtre, recherche]);

  const nbComptes = lignes.filter((l) => l.kind === 'compte').length;
  const nbSans = lignes.length - nbComptes;

  const definirRole = async (userId, appRole) => {
    try { await base44.functions.invoke('definir_role', { utilisateur_id: userId, app_role: appRole }); load(); }
    catch (e) { console.error(e); }
  };

  const definirSecondRole = async (u, valeur) => {
    try {
      await base44.functions.invoke('definir_role', {
        utilisateur_id: u.id,
        app_role: u.app_role,
        app_role_secondaire: valeur === 'aucun' ? '' : valeur
      });
      load();
    } catch (e) { console.error(e); }
  };

  const definirBase = async (userId, baseId) => {
    try { await base44.entities.User.update(userId, { base_id: baseId || null }); load(); }
    catch (e) { console.error(e); }
  };

  const ouvrirInvitation = (ligne) => {
    setInvite({
      ligne,
      email: ligne.email || '',
      role: ligne.kind === 'referent'
        ? (ligne.champ === 'chefs_atelier' ? 'chef_atelier' : 'responsable_sav')
        : 'commercial',
      base_id: ligne.base_id || ligne.baseId || ''
    });
  };

  const envoyerInvitation = async () => {
    const email = (invite?.email || '').trim();
    if (!email) return;
    setEnvoi(true);
    try {
      await base44.users.inviteUser(email, 'user');
      const res = await base44.functions.invoke('lister_utilisateurs', {});
      const nouveau = (res?.data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
      if (nouveau) {
        await base44.functions.invoke('definir_role', {
          utilisateur_id: nouveau.id,
          app_role: invite.role,
          base_id: invite.base_id || undefined
        });
        // La fiche commerciale garde ses clients et ses ventes : on la relie au compte.
        if (invite.ligne.kind === 'fiche') {
          await base44.entities.structure_commerciale.update(invite.ligne.id, {
            user_id: nouveau.id, email, statut: 'Invité'
          });
        }
      }
      setInvite(null);
      flash(`Invitation envoyée à ${email}.`);
      load();
      if (onReload) onReload();
    } catch (e) {
      flash('Erreur : ' + (e.message || 'invitation échouée'));
    } finally { setEnvoi(false); }
  };

  const supprimer = async () => {
    const ligne = aSupprimer;
    if (!ligne) return;
    try {
      if (ligne.kind === 'fiche') {
        await base44.entities.structure_commerciale.delete(ligne.id);
      } else if (ligne.kind === 'referent') {
        const site = sites.find((s) => s.id === ligne.baseId);
        const restants = (site?.[ligne.champ] || []).filter((n) => n !== ligne.nom);
        await base44.entities.base.update(ligne.baseId, { [ligne.champ]: restants });
      }
      setASupprimer(null);
      flash('Fiche supprimée.');
      load();
      if (onReload) onReload();
    } catch (e) {
      flash('Suppression impossible : ' + (e.message || 'erreur'));
      setASupprimer(null);
    }
  };

  const Filtre = ({ valeur, libelle, nombre }) => (
    <button
      onClick={() => setFiltre(valeur)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        filtre === valeur ? 'bg-gd-navy text-white' : 'bg-muted text-muted-foreground hover:text-gd-navy'
      }`}
    >
      {libelle} <span className="opacity-70">({nombre})</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <UserPlus className="h-4 w-4 text-gd-orange" /> Toutes les personnes
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comptes créés et personnes présentes dans les fichiers sans compte (fiches commerciales, référents d'atelier).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filtre valeur="tous" libelle="Tous" nombre={lignes.length} />
            <Filtre valeur="compte" libelle="Compte créé" nombre={nbComptes} />
            <Filtre valeur="sans" libelle="Sans compte" nombre={nbSans} />
          </div>
        </div>
        <div className="relative mt-3 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom, un email, un site…" className="pl-9" />
        </div>
        {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compte</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rôle / fonction</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Second rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base / site</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><Loader compact /></td></tr>
            ) : filtrees.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Personne ne correspond à cette recherche.</td></tr>
            ) : filtrees.map((l) => (
              <tr key={`${l.kind}-${l.id}`} className="border-b border-border last:border-0 align-middle">
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{l.nom || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.kind === 'fiche'
                      ? [l.fiche?.entite, l.fiche?.zone, l.fiche?.manager && `Manager : ${l.fiche.manager}`].filter(Boolean).join(' · ')
                      : l.email || '—'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {l.kind === 'compte' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Créé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      <CircleDashed className="h-3 w-3" /> Non créé
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.kind === 'compte' ? (
                    <Select value={l.app_role} onValueChange={(v) => definirRole(l.id, v)}>
                      <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : l.kind === 'referent' ? (
                    <span className="text-sm font-medium text-foreground">{l.fonction}</span>
                  ) : (
                    <span className="text-sm font-medium text-foreground">
                      Commercial
                      {l.fiche?.statut && <span className="ml-1.5 text-xs text-muted-foreground">({l.fiche.statut})</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.kind === 'compte' ? (
                    <Select value={l.secondaire || 'aucun'} onValueChange={(v) => definirSecondRole(l, v)}>
                      <SelectTrigger className="h-8 w-44"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {SECONDS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  {l.kind === 'compte' ? (
                    BASES_ROLES.includes(l.app_role) ? (
                      <Select value={l.base_id || 'aucune'} onValueChange={(v) => definirBase(l.id, v === 'aucune' ? '' : v)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aucune">—</SelectItem>
                          {sites.map((b) => <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{l.site || '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {l.kind !== 'compte' && (
                      <Button size="sm" variant="outline" onClick={() => ouvrirInvitation(l)} className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Créer le compte
                      </Button>
                    )}
                    {l.kind !== 'compte' && (
                      <Button size="sm" variant="ghost" onClick={() => setASupprimer(l)} title="Supprimer cette fiche" className="text-muted-foreground hover:text-gd-red">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {l.kind === 'compte' && l.fiche && (
                      <span className="text-xs text-muted-foreground">Fiche liée</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Supprimer une fiche ne supprime pas le compte : la suppression d'un compte se fait dans App Users, au tableau de bord.
      </p>

      {/* Invitation : on demande l'adresse, puis on applique le rôle et on relie la fiche. */}
      {invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Créer le compte de {invite.ligne.nom}</h3>
                <p className="text-xs text-muted-foreground">Un email d'invitation est envoyé ; la personne choisit son mot de passe.</p>
              </div>
              <button onClick={() => setInvite(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email professionnel</Label>
                <Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="prenom.nom@gonnin-duris.fr" />
              </div>
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Base de rattachement</Label>
                <Select value={invite.base_id || 'aucune'} onValueChange={(v) => setInvite({ ...invite, base_id: v === 'aucune' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une base…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucune">—</SelectItem>
                    {sites.map((b) => <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setInvite(null)}>Annuler</Button>
                <Button onClick={envoyerInvitation} disabled={envoi || !invite.email.trim()} className="bg-gd-navy text-white hover:bg-gd-navy-dark">
                  {envoi ? 'Envoi…' : 'Inviter'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!aSupprimer} onOpenChange={(o) => { if (!o) setASupprimer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {aSupprimer?.nom} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {aSupprimer?.kind === 'referent'
                ? `Ce nom sera retiré du site ${aSupprimer?.site}.`
                : 'La fiche commerciale sera supprimée. Les clients et ventes déjà rattachés ne sont pas supprimés.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={supprimer} className="bg-gd-red text-white hover:bg-gd-red/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}