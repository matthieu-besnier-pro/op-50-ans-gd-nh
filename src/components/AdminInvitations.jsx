import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';

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

  useEffect(() => {
    base44.entities.structure_commerciale.list('-nom_commercial', 500)
      .then((rows) => {
        const actifs = rows.filter((s) => s.entite !== 'Quitté');
        setStructure(actifs);
        const init = {};
        actifs.forEach((s) => { init[s.nom_commercial] = s.email || emailPropose(s.nom_commercial); });
        setEmails(init);
      })
      .catch(() => setErreur('Impossible de charger la structure commerciale.'));
  }, []);

  // Coller « Nom ; email » (ou tabulation, ou virgule) pour remplir d'un coup.
  const appliquerColle = () => {
    const parNom = {};
    structure.forEach((s) => { parNom[cle(s.nom_commercial)] = s.nom_commercial; });
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

  const lignes = useMemo(() => structure.map((s) => ({
    nom: s.nom_commercial,
    email: (emails[s.nom_commercial] || '').trim(),
    role: s.manager && cle(s.manager) === cle(s.nom_commercial) ? 'responsable' : 'commercial'
  })).filter((l) => l.email), [structure, emails]);

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
        {structure.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Chargement de la structure commerciale…</p>
        ) : structure.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 last:border-0">
            <span className="w-52 shrink-0 truncate text-sm font-semibold text-foreground">{s.nom_commercial}</span>
            <Input
              value={emails[s.nom_commercial] || ''}
              onChange={(e) => setEmails((m) => ({ ...m, [s.nom_commercial]: e.target.value }))}
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
