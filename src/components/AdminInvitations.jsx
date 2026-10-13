import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Mail, Loader2, CheckCircle2, AlertTriangle, Eye, UserPlus } from 'lucide-react';

const DOMAINE = 'gonnin-duris.fr';

const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const cle = (s) => sansAccent(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  .split(' ').filter(Boolean).sort().join(' ');

// Convention maison : prenom-nom@gonnin-duris.fr (tirets, sans accent).
// Les prénoms composés suivent la même règle : jean-francois-dragon@…
const emailPropose = (nom) => {
  const propre = sansAccent(nom).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return propre ? `${propre}@${DOMAINE}` : '';
};

const ROLES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'agri_precision', label: 'Agriculture de précision' },
  { value: 'responsable', label: 'Responsable commercial' },
  { value: 'chef_atelier', label: "Chef d'atelier" },
  { value: 'responsable_sav', label: 'Responsable SAV' },
  { value: 'collaborateur', label: 'Collaborateur' },
  { value: 'direction', label: 'Direction / Marketing' }
];

const ETATS = {
  invite: { libelle: 'Invité', classe: 'text-emerald-700' },
  mis_a_jour: { libelle: 'Mis à jour', classe: 'text-emerald-700' },
  deja_present: { libelle: 'Compte déjà présent', classe: 'text-muted-foreground' },
  a_inviter: { libelle: 'Sera invité', classe: 'text-gd-navy' },
  erreur: { libelle: 'Erreur', classe: 'text-gd-red font-semibold' }
};

/**
 * Invitation de toute l'équipe en une fois, avec les vraies adresses
 * professionnelles. Chacun reçoit l'invitation et choisit son mot de passe.
 */
export default function AdminInvitations() {
  const [structure, setStructure] = useState([]);
  const [emails, setEmails] = useState({});   // nom → adresse
  const [colle, setColle] = useState('');
  const [busy, setBusy] = useState(false);
  const [apercu, setApercu] = useState(null);
  const [erreur, setErreur] = useState('');
  // Invitation unitaire : retardataire, remplaçant, profil hors structure commerciale.
  const [solo, setSolo] = useState({ nom: '', email: '', role: 'commercial' });
  const [soloBusy, setSoloBusy] = useState(false);
  const [soloRes, setSoloRes] = useState(null);

  useEffect(() => {
    base44.entities.structure_commerciale.list('-nom_commercial', 500)
      .then((rows) => {
        const actifs = rows.filter((s) => s.entite !== 'Quitté');
        setStructure(actifs);
        const init = {};
        actifs.forEach((s) => { init[s.nom_commercial] = s.email || emailPropose(s.nom_commercial); });
        // Responsables : déduits du champ « manager », ils n'ont pas de fiche propre.
        actifs.forEach((s) => {
          const m = (s.manager || '').trim();
          if (m && !init[m]) init[m] = emailPropose(m);
        });
        setEmails(init);
      })
      .catch(() => setErreur('Impossible de charger la structure commerciale.'));
  }, []);

  // Coller « Nom ; email » (ou tabulation, ou virgule) pour remplir d'un coup.
  const appliquerColle = () => {
    const parNom = {};
    personnes.forEach((p) => { parNom[cle(p.nom)] = p.nom; });
    let trouves = 0;
    const maj = { ...emails };
    colle.split('\n').forEach((ligne) => {
      const m = ligne.match(/^(.*?)[;,\t]+(.*)$/);
      if (!m) return;
      const nomExact = parNom[cle(m[1])];
      const adresse = m[2].trim().toLowerCase();
      if (nomExact && adresse) { maj[nomExact] = adresse; trouves += 1; }
    });
    setEmails(maj);
    setErreur(trouves === 0 ? 'Aucun nom reconnu. Format attendu : « Nom ; adresse@… » (une par ligne).' : '');
  };

  // Les responsables n'ont pas de ligne à eux : ils apparaissent comme « manager »
  // de leurs vendeurs. Sans ça, ils n'étaient jamais invités.
  const personnes = useMemo(() => {
    const parCle = new Map();
    structure.forEach((s) => {
      if (s.nom_commercial) parCle.set(cle(s.nom_commercial), { nom: s.nom_commercial, role: 'commercial' });
    });
    structure.forEach((s) => {
      const m = (s.manager || '').trim();
      if (!m) return;
      // Un responsable qui a aussi un portefeuille garde le rôle responsable.
      parCle.set(cle(m), { nom: parCle.get(cle(m))?.nom || m, role: 'responsable' });
    });
    return [...parCle.values()].sort((a, b) => {
      if (a.role !== b.role) return a.role === 'responsable' ? -1 : 1;
      return a.nom.localeCompare(b.nom, 'fr');
    });
  }, [structure]);

  const lignes = useMemo(() => personnes
    .map((p) => ({ nom: p.nom, email: (emails[p.nom] || '').trim(), role: p.role }))
    .filter((l) => l.email), [personnes, emails]);

  // L'adresse se déduit du nom tant qu'on ne l'a pas saisie à la main.
  const majSoloNom = (nom) => setSolo((v) => ({
    ...v, nom,
    email: v.emailTouche ? v.email : emailPropose(nom)
  }));

  const inviterUn = async () => {
    const nom = solo.nom.trim();
    const email = solo.email.trim().toLowerCase();
    if (!nom || !email) { setSoloRes({ etat: 'erreur', detail: 'Indiquez un nom et une adresse.' }); return; }
    setSoloBusy(true); setSoloRes(null);
    try {
      const res = await base44.functions.invoke('inviter_equipe', {
        lignes: [{ nom, email, role: solo.role }]
      });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      setSoloRes(d.resultats?.[0] || null);
      if (d.resultats?.[0]?.etat !== 'erreur') setSolo({ nom: '', email: '', role: solo.role });
    } catch (e) {
      setSoloRes({ etat: 'erreur', detail: e?.response?.data?.error || e?.message || "L'invitation a échoué." });
    } finally {
      setSoloBusy(false);
    }
  };

  const lancer = async (dryRun) => {
    setBusy(true); setErreur(''); if (!dryRun) setApercu(null);
    try {
      const res = await base44.functions.invoke('inviter_equipe', { lignes, dry_run: dryRun });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      setApercu(d);
    } catch (e) {
      setErreur(e?.response?.data?.error || e?.message || "L'opération a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-gd-navy/20 bg-card p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
        <Mail className="h-4 w-4 text-gd-orange" /> Inviter l'équipe
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Invite tout le monde d'un coup avec les <strong>vraies adresses professionnelles</strong>.
        Chacun reçoit un mail et choisit son mot de passe. Le rôle et la fiche commerciale
        sont rattachés automatiquement. Relancer est sans risque : les comptes déjà créés
        sont simplement mis à jour.
      </p>

      {/* Invitation unitaire : le cas le plus fréquent en cours d'opération. */}
      <div className="mb-4 rounded-lg border-2 border-gd-orange/30 bg-gd-orange/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gd-navy-dark">
          <UserPlus className="h-3.5 w-3.5 text-gd-orange" /> Inviter une seule personne
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[11rem] flex-1">
            <Label className="text-xs">Nom</Label>
            <Input value={solo.nom} onChange={(e) => majSoloNom(e.target.value)}
              placeholder="Alexandre BELLIN" className="mt-1 h-9" />
          </div>
          <div className="min-w-[15rem] flex-1">
            <Label className="text-xs">Adresse</Label>
            <Input value={solo.email}
              onChange={(e) => setSolo((v) => ({ ...v, email: e.target.value, emailTouche: true }))}
              placeholder="prenom-nom@gonnin-duris.fr" className="mt-1 h-9" />
          </div>
          <div className="min-w-[12rem]">
            <Label className="text-xs">Rôle</Label>
            <Select value={solo.role} onValueChange={(v) => setSolo((s2) => ({ ...s2, role: v }))}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={inviterUn} disabled={soloBusy}
            className="h-9 bg-gd-orange hover:bg-gd-orange/90 text-gd-navy-dark font-semibold">
            {soloBusy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Envoi…</>
                      : <><Mail className="h-4 w-4 mr-1.5" /> Inviter</>}
          </Button>
        </div>
        {soloRes && (
          <p className={`mt-2 text-xs ${ETATS[soloRes.etat]?.classe || 'text-gd-red'}`}>
            {ETATS[soloRes.etat]?.libelle || 'Erreur'} — {soloRes.detail}
          </p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
        <Label className="text-xs">Coller la liste (une ligne par personne : <code>Nom ; adresse</code>)</Label>
        <Textarea rows={4} value={colle} onChange={(e) => setColle(e.target.value)}
          placeholder={'Alexandre BELLIN ; alexandre-bellin@gonnin-duris.fr\nGaylord FOURNIER ; gaylord-fournier@gonnin-duris.fr'}
          className="mt-1 font-mono text-xs" />
        <Button onClick={appliquerColle} size="sm" variant="outline" className="mt-2">
          Appliquer à la liste
        </Button>
      </div>

      <div className="mb-4 max-h-80 overflow-y-auto rounded-lg border border-border">
        {personnes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Chargement de la structure commerciale…</p>
        ) : personnes.map((p) => (
          <div key={p.nom} className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 last:border-0">
            <span className="w-52 shrink-0 truncate text-sm font-semibold text-foreground">{p.nom}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              p.role === 'responsable' ? 'bg-gd-navy text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {p.role === 'responsable' ? 'Responsable' : 'Commercial'}
            </span>
            <Input
              value={emails[p.nom] || ''}
              onChange={(e) => setEmails((m) => ({ ...m, [p.nom]: e.target.value }))}
              placeholder="prenom-nom@gonnin-duris.fr"
              className="h-8 max-w-xs flex-1 text-xs"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => lancer(true)} disabled={busy || lignes.length === 0} variant="outline"
          className="border-gd-navy text-gd-navy hover:bg-gd-navy/10">
          {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> …</>
                : <><Eye className="h-4 w-4 mr-1.5" /> Aperçu ({lignes.length})</>}
        </Button>
        <Button onClick={() => lancer(false)} disabled={busy || lignes.length === 0}
          className="bg-gd-navy hover:bg-gd-navy-dark text-white">
          {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Invitation…</>
                : <><Mail className="h-4 w-4 mr-1.5" /> Inviter {lignes.length} personne(s)</>}
        </Button>
      </div>

      {erreur && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erreur}
        </div>
      )}

      {apercu && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gd-navy-dark">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {apercu.dry_run
              ? `Aperçu : ${apercu.a_inviter} à inviter, ${apercu.deja_present} déjà présent(s), ${apercu.erreurs} erreur(s)`
              : `${apercu.invites} invitation(s) envoyée(s), ${apercu.mis_a_jour} compte(s) mis à jour, ${apercu.erreurs} erreur(s)`}
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
            {apercu.resultats.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="w-44 shrink-0 truncate font-medium text-foreground">{r.nom}</span>
                <span className="w-56 shrink-0 truncate text-muted-foreground">{r.email}</span>
                <span className={ETATS[r.etat]?.classe || ''}>{ETATS[r.etat]?.libelle || r.etat}</span>
                <span className="text-muted-foreground">— {r.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
