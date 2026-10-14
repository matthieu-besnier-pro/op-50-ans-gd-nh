import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { listerPartage, invalider } from '@/lib/donneesPartagees';
import { fetchOperationStats, invaliderStats } from '@/lib/operationStats';
import { fetchAtelierStats, invaliderAtelierStats } from '@/lib/atelierStats';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { jouerAcclamation, debloquerSon, sonDebloque, sourceSon, enSourdine, basculerSourdine } from '@/lib/acclamation';
import OpLogo from '@/components/OpLogo';
import {
  Zap, Trophy, Wrench, Flame, Target,
  CalendarCheck, Sparkles, X, Satellite, Volume2, VolumeX,
  TrendingUp, Clock
} from 'lucide-react';

/* ---------- Célébration ---------- */
// Trois salves : le centre, puis les deux côtés. L'échelonnement est voulu ;
// ce qui doit être simultané, c'est le DÉPART de la salve et l'apparition du
// rendez-vous à l'écran.
function lancerConfettis() {
  // Le son part sur la MÊME instruction que la première salve : c'est ce qui
  // fait l'effet. Il est sans effet tant que personne n'a activé le son.
  jouerAcclamation();
  confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#FFC107', '#00356B', '#ffffff', '#FFD54F'] });
  // Cotillons : de grandes pastilles lâchées du haut, qui tombent lentement en
  // dérivant pendant que les salves vives éclatent en dessous.
  setTimeout(() => confetti({
    particleCount: 60, spread: 120, startVelocity: 25, gravity: 0.5,
    scalar: 1.5, ticks: 320, drift: 0.4, origin: { y: 0 },
    colors: ['#FFC107', '#00356B', '#ffffff', '#FFD54F']
  }), 120);
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#FFC107', '#ffffff'] }), 200);
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#FFC107', '#ffffff'] }), 400);
}

/* ---------- Animated counter ---------- */
function AnimatedCounter({ value, duration = 1000, className = '' }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress >= 1) { clearInterval(timer); prevRef.current = end; }
    }, 30);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span className={className}>{display}</span>;
}

/* ---------- Progress ring ---------- */
function ProgressRing({ value, max, size = 220, stroke = 18, color = 'hsl(45 100% 51%)', label, sublabel }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;
  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedCounter value={value} className={`font-extrabold text-white tabular-nums ${size >= 160 ? 'text-6xl' : 'text-3xl'}`} />
          {sublabel && <span className={`font-medium text-white/50 ${size >= 160 ? 'text-sm mt-0.5' : 'text-[10px]'}`}>/ {max} {sublabel}</span>}
        </div>
      </div>
      {label && <span className={`font-bold uppercase tracking-widest text-white/70 ${size >= 160 ? 'mt-3 text-sm' : 'mt-1.5 text-[10px]'}`}>{label}</span>}
    </div>
  );
}

/* ---------- Podium ---------- */
// Les trois premiers sortent de la liste : sur un écran projeté, un podium se
// lit d'un coup d'œil là où une suite de lignes se ressemble toutes.
// Ordre d'affichage : 2e à gauche, 1er au centre sur la marche haute, 3e à droite.
const MARCHES = [
  { rang: 2, medaille: '🥈', hauteur: 84, socle: 'from-slate-200/30 to-slate-400/5', bord: 'border-slate-200/40' },
  { rang: 1, medaille: '🥇', hauteur: 120, socle: 'from-gd-orange/45 to-yellow-300/5', bord: 'border-gd-orange/60' },
  { rang: 3, medaille: '🥉', hauteur: 56, socle: 'from-amber-600/30 to-amber-800/5', bord: 'border-amber-500/40' }
];

// Trois tailles : l'écran porte maintenant deux classements, le podium doit
// savoir se faire petit pour laisser la grille tenir sans défilement.
const TAILLES_PODIUM = {
  grand: { medaille1: 'text-4xl', medaille: 'text-3xl', nom1: 'text-lg', nom: 'text-base', chiffre1: 'text-5xl', chiffre: 'text-3xl', rang: 'text-2xl', marche: 1, marge: 'mb-5' },
  moyen: { medaille1: 'text-3xl', medaille: 'text-2xl', nom1: 'text-base', nom: 'text-sm', chiffre1: 'text-4xl', chiffre: 'text-2xl', rang: 'text-lg', marche: 0.7, marge: 'mb-3' },
  petit: { medaille1: 'text-2xl', medaille: 'text-xl', nom1: 'text-sm', nom: 'text-xs', chiffre1: 'text-3xl', chiffre: 'text-xl', rang: 'text-sm', marche: 0.45, marge: 'mb-2' }
};

// Valeurs de départ de la moitié « ateliers » : une référence stable, pour que le
// classement ne se recalcule pas à chaque rendu.
const ATELIER_VIDE = { cibles: 0, contactes: 0, ok: 0, refus: 0, rdv_pris: 0, restants: 0, par_site: {}, recents: [] };

function Podium({ entrees, unite, taille = 'grand' }) {
  const t = TAILLES_PODIUM[taille] || TAILLES_PODIUM.grand;
  return (
    <div className={`flex items-end justify-center gap-3 shrink-0 ${t.marge}`}>
      {MARCHES.map((m) => {
        const e = entrees[m.rang - 1];
        // Moins de trois commerciaux classés : la marche reste vide plutôt que
        // de décaler le podium.
        if (!e) return <div key={m.rang} className="flex-1" />;
        return (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="flex-1 min-w-0 flex flex-col items-center"
          >
            <div className={`leading-none ${m.rang === 1 ? t.medaille1 : t.medaille}`}>{m.medaille}</div>
            <p className={`mt-1.5 w-full truncate text-center font-bold text-white ${m.rang === 1 ? t.nom1 : t.nom}`}>
              {e.name}
            </p>
            <div className="flex items-baseline gap-1.5">
              <AnimatedCounter value={e.count} className={`font-extrabold tabular-nums ${m.rang === 1 ? `${t.chiffre1} text-gd-orange` : `${t.chiffre} text-white`}`} />
              <span className="text-[11px] uppercase tracking-widest text-white/40">{unite}</span>
            </div>
            <div
              className={`mt-2 w-full overflow-hidden rounded-t-2xl border border-b-0 bg-gradient-to-b ${m.socle} ${m.bord} flex items-start justify-center pt-1`}
              style={{ height: Math.round(m.hauteur * t.marche) }}
            >
              {/* Chiffre décoratif : la marche la plus basse est courte, il doit
                  y tenir sans déborder. */}
              <span className={`font-black leading-none text-white/25 ${t.rang}`}>{m.rang}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------- Leaderboard row ---------- */
// Densité des places 4 et suivantes. L'argument est le nombre de LIGNES de la
// grille, pas le nombre de commerciaux : trois colonnes en logent trois.
function densiteClassement(n) {
  if (n <= 3) return { pad: 'px-4 py-4', gap: 'gap-3', rang: 'text-2xl w-9', nom: 'text-2xl', compteur: 'text-4xl', icone: 'h-6 w-6', grille: 'gap-3' };
  if (n <= 5) return { pad: 'px-4 py-3', gap: 'gap-3', rang: 'text-xl w-8', nom: 'text-xl', compteur: 'text-3xl', icone: 'h-5 w-5', grille: 'gap-3' };
  if (n <= 8) return { pad: 'px-3 py-2', gap: 'gap-2', rang: 'text-base w-6', nom: 'text-base', compteur: 'text-2xl', icone: 'h-4 w-4', grille: 'gap-2' };
  return { pad: 'px-2.5 py-1.5', gap: 'gap-2', rang: 'text-sm w-5', nom: 'text-sm', compteur: 'text-xl', icone: 'h-3.5 w-3.5', grille: 'gap-1.5' };
}

// À trois colonnes, « Corentin BERNIER » ne tient pas dans la carte. Plutôt
// que de tronquer le nom de famille — justement ce qu'on reconnaît de loin —
// on réduit le prénom à son initiale.
function nomAbrege(nom) {
  const mots = String(nom || '').trim().split(/\s+/);
  if (mots.length < 2) return nom || '';
  return `${mots[0].charAt(0).toUpperCase()}. ${mots.slice(1).join(' ')}`;
}

function LeaderRow({ rank, name, count, total, isAtelier, prevRank, d, abrege }) {
  // Un minimum de remplissage : même le dernier doit avoir une carte habitée.
  const pct = total > 0 ? Math.max((count / total) * 100, 8) : 0;
  const movedUp = prevRank !== null && prevRank > rank;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-xl border border-white/5 bg-white/5"
    >
      {/* La progression devient le FOND de la carte : aussi lisible de loin
          qu'une barre, sans la hauteur qu'une barre séparée coûterait. */}
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-gd-orange/35 to-gd-orange/5"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <div className={`relative flex items-center ${d.gap} ${d.pad}`}>
        <span className={`${d.rang} shrink-0 text-center font-black tabular-nums text-white/35`}>{rank}</span>
        <span className={`${d.nom} min-w-0 flex-1 truncate font-bold text-white`}>
          {abrege ? nomAbrege(name) : name}
        </span>
        {isAtelier && <Wrench className={`${d.icone} shrink-0 text-gd-orange`} />}
        {movedUp && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0 text-gd-orange">
            <Flame className={d.icone} />
          </motion.span>
        )}
        <AnimatedCounter value={count} className={`${d.compteur} shrink-0 font-extrabold tabular-nums text-white`} />
      </div>
    </motion.div>
  );
}

/* ---------- Briques partagées par les deux moitiés ---------- */

// Compteur compact : l'écran accueille deux univers, les gros pavés verticaux
// d'origine ne tiennent plus.
function Compteur({ Icone, valeur, libelle, couleur, fond }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl ${fond} px-3 py-2`}>
      <Icone className={`h-5 w-5 shrink-0 ${couleur}`} />
      <div className="min-w-0">
        <p className={`text-2xl font-extrabold leading-none ${couleur}`}><AnimatedCounter value={valeur} /></p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-white/40">{libelle}</p>
      </div>
    </div>
  );
}

// Podium + grille. Commerce et ateliers s'affichent avec la MÊME brique : c'est
// ce qui fait que les deux moitiés se lisent pareil.
function BlocClassement({ liste, unite, abrege, prevRanks, vide }) {
  if (liste.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <Flame className="mb-3 h-10 w-10 text-gd-orange/40" />
        <p className="text-base font-semibold text-white/60">{vide}</p>
      </div>
    );
  }
  const reste = liste.slice(3);
  // Trois colonnes dès qu'il y a du monde : trois fois moins de lignes qu'une
  // liste, donc des cartes plus grosses. En dessous de sept, deux colonnes
  // rendent mieux que trois cartes esseulées sur la dernière ligne.
  const colonnes = reste.length <= 6 ? 2 : 3;
  const lignes = Math.ceil(reste.length / colonnes);
  const d = densiteClassement(lignes);
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${reste.length === 0 ? 'justify-center' : ''}`}>
      <Podium entrees={liste.slice(0, 3)} unite={unite} taille={lignes <= 3 ? 'grand' : lignes <= 6 ? 'moyen' : 'petit'} />
      {reste.length > 0 && (
        <div className={`grid ${colonnes === 2 ? 'grid-cols-2' : 'grid-cols-3'} content-start ${d.grille} min-h-0 flex-1 overflow-y-auto pr-1`}>
          <AnimatePresence>
            {reste.map((entree, i) => (
              <LeaderRow
                key={entree.id}
                rank={i + 4}
                name={entree.name}
                count={entree.count}
                total={liste[0]?.count || 1}
                isAtelier={entree.isAtelier}
                prevRank={prevRanks[entree.id] || null}
                d={d}
                abrege={abrege && colonnes === 3}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Contact pris par un atelier : le client, son site, et l'issue de l'appel.
function LigneContactAtelier({ contact }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
    >
      <Wrench className={`h-4 w-4 shrink-0 ${contact.refus ? 'text-white/30' : 'text-gd-orange'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{contact.nom || 'Client'}</p>
        <p className="truncate text-[10px] uppercase tracking-wide text-white/40">
          {contact.site}
          {contact.creneau ? ` · ${new Date(contact.creneau).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        contact.refus ? 'bg-white/10 text-white/50' : 'bg-gd-orange/20 text-gd-orange'
      }`}>
        {contact.refus ? 'Refus' : contact.creneau ? 'RDV posé' : 'OK RDV'}
      </span>
    </motion.div>
  );
}

/* ---------- Live feed item ---------- */
function FeedItem({ rdv, clientName, userName, isNew }) {
  const isAtelier = rdv.type === 'RDV atelier hivernage';
  return (
    <motion.div
      initial={{ opacity: 0, y: -15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${isNew ? 'bg-gd-orange/20 border border-gd-orange/40' : 'bg-white/5 border border-white/5'}`}
    >
      <div className={`flex h-4 w-4 shrink-0 items-center justify-center ${isAtelier ? 'text-gd-orange' : 'text-white/60'}`}>
        {isAtelier ? <Wrench className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{clientName || 'Client'}</p>
        <p className="truncate text-[10px] uppercase tracking-wide text-white/40">{userName || 'Commercial'}</p>
      </div>
      <p className="shrink-0 text-xs tabular-nums text-white/40">
        {rdv.date_heure ? new Date(rdv.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
      </p>
    </motion.div>
  );
}

/* ---------- Main component ---------- */
export default function GrandEcran() {
  const [params, setParams] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [users, setUsers] = useState([]);
  const [structure, setStructure] = useState([]);
  const [clients, setClients] = useState({});
  const [now, setNow] = useState(new Date());
  const [prevRanks, setPrevRanks] = useState({});
  const [recentEvent, setRecentEvent] = useState(null);
  // Garde-fou de débit : relire les comptages serveur parcourt TOUTE la base
  // (une douzaine de lectures en rafale). Forcer cette relecture à chaque
  // rendez-vous, sur chaque écran ouvert, sature la limite de la plateforme et
  // fait échouer les autres appels — les exports, notamment. On ne la force
  // donc qu'une fois toutes les 20 s ; entre deux, la liste des rendez-vous
  // suffit à tenir le feed juste.
  const derniersComptages = useRef(0);
  // Le navigateur garde le son bloqué tant que personne n'a cliqué sur la page :
  // l'écran est projeté sans qu'on y touche, il faut donc un bouton explicite.
  const [sonPret, setSonPret] = useState(false);
  const [muet, setMuet] = useState(false);
  // D'où sort le son, pour pouvoir le dire au lieu de laisser deviner.
  const [sourceAudio, setSourceAudio] = useState('aucune');
  const [echecSon, setEchecSon] = useState(false);

  // Demo mode: ?demo=sprint | ?demo=ventes
  const demoMode = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get('demo');
    if (p === 'sprint') return { key: 'sprint', phase: 'sprint', date: new Date('2026-10-14T14:00:00') };
    if (p === 'ventes') return { key: 'ventes', phase: 'ventes', date: new Date('2026-10-16T10:00:00') };
    return null;
  }, []);

  const [exacts, setExacts] = useState(null);
  // Contacts atelier : comptés par leur propre fonction, qui ne lit que les clients
  // ciblés par l'atelier. Le balayage complet, trop lourd pour cet écran, n'est plus
  // sur le chemin de la moitié ateliers.
  const [atelierExact, setAtelierExact] = useState(null);

  // Tout est préparé AVANT le moindre setState : sur un écran projeté, la
  // célébration doit tomber d'un seul bloc. Auparavant les confettis partaient
  // dès l'événement temps réel, la ligne du feed arrivait une seconde plus tard,
  // et les compteurs — mis en cache une minute — ne bougeaient pas du tout.
  const load = useCallback(async (celebration) => {
    const feter = (data) => {
      setRecentEvent({ data, time: Date.now() });
      lancerConfettis();
    };
    try {
      const [p, r, v, u, st, statsRes, atelierRes] = await Promise.all([
        listerPartage('parametres_operation', '-created_date', 1),
        listerPartage('rdv', '-date_heure', 500),
        listerPartage('vente', '-date_vente', 500),
        listerPartage('User', '-created_date', 300).catch(() => []),
        listerPartage('structure_commerciale', '-nom_commercial', 200),
        fetchOperationStats(),
        fetchAtelierStats()
      ]);

      // Le rendez-vous vient d'être créé : s'il n'est pas encore remonté dans la
      // liste relue, on l'ajoute, pour que le feed et la salve restent d'accord.
      let liste = r;
      if (celebration?.data?.id && !r.some((x) => x.id === celebration.data.id)) {
        // Le feed se trie sur created_date : sans date, la ligne injectée
        // tomberait en fin de liste et n'apparaîtrait pas avec la salve.
        const nouveau = { ...celebration.data };
        if (!nouveau.created_date) nouveau.created_date = new Date().toISOString();
        liste = [nouveau, ...r];
      }

      // Noms des clients du feed, lus côté serveur : les droits du navigateur
      // varient selon le compte qui projette, et l'écran doit toujours afficher
      // « RDV chez X ». Charge minimale : identifiant et raison sociale.
      const clientIds = [...new Set(liste.map(rd => rd.client_id).filter(Boolean))].slice(0, 100);
      let noms = null;
      if (clientIds.length > 0) {
        const res = await base44.functions
          .invoke('lister_clients', { noms_client_ids: clientIds })
          .catch(() => null);
        if (res?.data?.noms) {
          noms = {};
          res.data.noms.forEach((c) => { noms[c.id] = c; });
        }
      }

      // Un comptage raté (limite de débit) ne doit pas vider ce qui est déjà à
      // l'écran : sur un écran projeté, mieux vaut des chiffres d'une minute que
      // deux moitiés vides le temps que le serveur respire.
      setExacts((precedent) => statsRes || precedent);
      setAtelierExact((precedent) => atelierRes || precedent);
      setParams(p[0] || null);
      setRdvs(liste);
      setVentes(v);
      setUsers(u);
      setStructure(st);
      // Une lecture de noms ratée laisse les précédents en place plutôt que de
      // vider les raisons sociales du feed.
      if (noms) setClients(noms);
      if (celebration) feter(celebration.data);
    } catch (e) {
      console.error(e);
      // L'écran ne doit jamais rater une célébration à cause d'une lecture ratée.
      if (celebration) feter(celebration.data);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = base44.entities.rdv.subscribe((event) => {
      // Les caches sont vidés AVANT la relecture : sans cela le compteur et le
      // classement, mis en cache une minute, restaient figés pendant que les
      // confettis tombaient déjà. Vaut aussi pour une annulation, qui doit se
      // soustraire immédiatement.
      invalider('rdv');
      if (Date.now() - derniersComptages.current > 20000) {
        derniersComptages.current = Date.now();
        invaliderStats();
        invaliderAtelierStats();
      }
      // Confettis, bandeau, ligne du feed, compteurs et podium partent ensemble,
      // une fois les données arrivées : c'est load() qui déclenche la salve.
      load(event.type === 'create' ? { data: event.data } : undefined);
    });
    return unsubscribe;
  }, [load]);

  // Clock (demo mode ticks from simulated date)
  useEffect(() => {
    if (demoMode) {
      const startReal = Date.now();
      const startSim = demoMode.date.getTime();
      setNow(new Date(startSim));
      const timer = setInterval(() => {
        setNow(new Date(startSim + (Date.now() - startReal)));
      }, 1000);
      return () => clearInterval(timer);
    }
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [demoMode]);

  useEffect(() => {
    setSonPret(sonDebloque());
    setMuet(enSourdine());
  }, []);

  const activerSon = async () => {
    const ok = await debloquerSon();
    setSonPret(ok);
    setEchecSon(!ok);
    setSourceAudio(sourceSon());
    // Confirmation à l'oreille : on sait tout de suite que la salle entendra.
    if (ok) jouerAcclamation();
  };

  // Clear recent event after 5s
  useEffect(() => {
    if (recentEvent) {
      const t = setTimeout(() => setRecentEvent(null), 5000);
      return () => clearTimeout(t);
    }
  }, [recentEvent]);

  // Name resolver: le commercial_id est un user_id. On résout via structure_commerciale.user_id
  // (car list sur l'entité User est refusée par Base44), avec repli sur users si dispo.
  const nameMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u.full_name || u.email; });
    structure.forEach(s => {
      m[s.id] = s.nom_commercial;
      if (s.user_id) m[s.user_id] = s.nom_commercial;
    });
    return m;
  }, [users, structure]);


  // Phase detection
  const phase = useMemo(() => {
    if (demoMode) return demoMode.phase;
    if (!params?.date_debut_prise_rdv) return 'sprint';
    const fin = new Date(params.date_fin_prise_rdv + 'T23:59:59');
    const ventesStart = new Date(fin); ventesStart.setDate(ventesStart.getDate() + 1);
    if (now <= fin) return 'sprint';
    if (now < ventesStart) return 'transition';
    return 'ventes';
  }, [params, now, demoMode]);

  // Sprint RDV stats
  const sprintRdvs = useMemo(() => {
    if (!params?.date_debut_prise_rdv) return [];
    return rdvs.filter(r => {
      // Un rendez-vous annulé est soustrait : ni du compteur, ni du classement.
      if (r.statut === 'Annulé') return false;
      // Le sprint récompense la PRISE de rendez-vous : on retient la date à
      // laquelle il a été posé, pas celle à laquelle il aura lieu. Un RDV pris
      // le 13 pour le 25 compte bien pour le sprint.
      // Le rendez-vous atelier est compté côté atelier : il n'apparaît pas dans
      // l'affichage commerce (compteur, classement et fil).
      if (r.type === 'RDV atelier hivernage') return false;
      const d = (r.created_date || r.date_heure || '').slice(0, 10);
      return d >= params.date_debut_prise_rdv && d <= params.date_fin_prise_rdv;
    });
  }, [rdvs, params]);

  // Comptages exacts côté serveur ; repli sur la liste chargée en attendant.
  // Total commerce : les rendez-vous atelier sont retirés du comptage (ils sont
  // comptés dans la moitié atelier), pour ne pas compter deux fois le même RDV.
  const sprintRdvCount = exacts?.rdv?.sprint
    ? (exacts.rdv.sprint.total || 0) - (exacts.rdv.sprint.atelier || 0)
    : sprintRdvs.length;
  const objRdv = params?.objectif_rdv || 100;
  const sprintCommercialCount = exacts?.rdv?.sprint?.commercial ?? sprintRdvs.filter(r => r.type === 'RDV commercial').length;
  const sprintAgriCount = exacts?.rdv?.sprint?.agri ?? sprintRdvs.filter(r => r.type === 'RDV agri. précision').length;

  // Leaderboard
  // Classement : on prend les comptages du serveur, qui parcourt TOUS les
  // rendez-vous. La liste chargée ici est plafonnée et triée par date : s'en
  // servir faisait disparaître du classement les commerciaux dont les
  // rendez-vous tombaient hors de la tranche chargée.
  const leaderboard = useMemo(() => {
    // Classement commerce : rendez-vous atelier exclus, ils sont comptés côté atelier.
    const exact = exacts?.rdv?.sprint_par_commercial_commerce;
    const counts = {};
    if (exact && Object.keys(exact).length > 0) {
      Object.entries(exact).forEach(([id, n]) => { counts[id] = n; });
    } else {
      sprintRdvs.forEach(r => {
        if (!r.commercial_id) return;
        counts[r.commercial_id] = (counts[r.commercial_id] || 0) + 1;
      });
    }
    const entries = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({
        id, count, name: nameMap[id] || `Commercial ${id.slice(-4)}`,
        // Indication visuelle seulement : déduite des rendez-vous chargés.
        isAtelier: sprintRdvs.some(r => r.commercial_id === id && r.type === 'RDV atelier hivernage')
      }));
    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [exacts, sprintRdvs, nameMap]);

  // Les contacts pris par les ateliers. Le marquage n'enregistre pas QUI l'a
  // posé, seulement le client et son site : le classement se fait donc par
  // atelier, ce qui est aussi la maille demandée.
  const atelier = atelierExact || exacts?.atelier || ATELIER_VIDE;

  // Les refus ne s'affichent plus : le fil atelier ne montre que les rendez-vous obtenus.
  const contactsAtelier = (atelier.recents || []).filter((c) => !c.refus);

  const classementAteliers = useMemo(() => {
    const sites = atelier.par_site || {};
    return Object.entries(sites)
      .map(([site, v]) => ({ id: site, name: site, count: v.contactes || 0 }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [atelier]);

  const [prevRangsAtelier, setPrevRangsAtelier] = useState({});
  useEffect(() => {
    const nouveaux = {};
    classementAteliers.forEach((e, i) => { nouveaux[e.id] = i + 1; });
    const t = setTimeout(() => setPrevRangsAtelier(nouveaux), 3000);
    return () => clearTimeout(t);
  }, [classementAteliers]);

  // Track rank changes
  useEffect(() => {
    const newRanks = {};
    leaderboard.forEach((e, i) => { newRanks[e.id] = i + 1; });
    setPrevRanks(prev => {
      const updated = { ...prev };
      Object.keys(newRanks).forEach(id => {
        if (prev[id] !== undefined) updated[id] = prev[id];
      });
      return updated;
    });
    const t = setTimeout(() => setPrevRanks(newRanks), 3000);
    return () => clearTimeout(t);
  }, [leaderboard]);

  // Live feed (most recent RDVs)
  const liveFeed = useMemo(() => {
    // Un rendez-vous annulé ne doit pas défiler comme une victoire.
    return rdvs
      // Ni les annulés, ni les rendez-vous atelier : ils défilent côté atelier.
      .filter((r) => r.statut !== 'Annulé' && r.type !== 'RDV atelier hivernage')
      .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))
      .slice(0, 8);
  }, [rdvs]);

  // Ventes stats (phase ventes)
  const ventesValidees = ventes.filter(v => v.statut_validation === 'Validé');
  const ventesLeaderboard = useMemo(() => {
    const counts = {};
    ventesValidees.forEach(v => {
      if (!v.commercial_id) return;
      counts[v.commercial_id] = (counts[v.commercial_id] || 0) + 1;
    });
    return Object.entries(counts).map(([id, count]) => ({
      id, count, name: nameMap[id] || `Commercial ${id.slice(-4)}`
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [ventesValidees, nameMap]);

  const phaseLabel = {
    sprint: { text: 'SPRINT RDV EN COURS', color: 'text-gd-orange', icon: Zap },
    transition: { text: 'Transition vers les ventes', color: 'text-white/70', icon: TrendingUp },
    ventes: { text: 'SPRINT VENTES', color: 'text-gd-orange', icon: TrendingUp }
  }[phase];

  const PhaseIcon = phaseLabel?.icon || Clock;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gd-navy-dark via-gd-navy to-gd-navy-dark text-white overflow-hidden">
      {/* Decorative glow */}
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-gd-orange/20 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <OpLogo
            className="h-14 w-14 rounded-full object-contain"
            fallback={(
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gd-orange text-gd-navy-dark">
                <Zap className="h-7 w-7" fill="currentColor" />
              </div>
            )}
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">CockpitOP</h1>
            <p className="text-xs font-medium uppercase tracking-widest text-gd-orange">50 ans Gonnin Duris × New Holland</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${phase === 'sprint' ? 'bg-gd-orange/20 border border-gd-orange/40 animate-pulse' : 'bg-white/5 border border-white/10'}`}>
            <PhaseIcon className={`h-5 w-5 ${phaseLabel.color}`} />
            <span className={`text-sm font-bold uppercase tracking-wider ${phaseLabel.color}`}>{phaseLabel.text}</span>
          </div>
          {demoMode && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-400/40">
              <span className="text-sm font-bold uppercase tracking-wider text-purple-300">Démo</span>
            </div>
          )}
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums leading-none">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {!sonPret ? (
            <button
              onClick={activerSon}
              title={echecSon
                ? "Aucune source audio n'a pu démarrer — réessayez, ou vérifiez le volume du poste"
                : "Le son reste bloqué par le navigateur tant que personne n'a cliqué sur la page"}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                echecSon
                  ? 'border-gd-red/50 bg-gd-red/20 text-red-200 hover:bg-gd-red/30'
                  : 'border-gd-orange/50 bg-gd-orange/20 text-gd-orange hover:bg-gd-orange/30'
              }`}
            >
              {echecSon ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {echecSon ? 'Son indisponible — réessayer' : 'Activer le son'}
            </button>
          ) : (
            <button
              onClick={() => setMuet(basculerSourdine())}
              title={`${muet ? 'Remettre le son' : 'Couper le son'} — source : ${
                { lien: 'lien web', fichier: 'fichier déposé', synthese: 'synthèse' }[sourceAudio] || 'inconnue'
              }`}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              {muet ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-gd-orange" />}
              {muet ? 'Son coupé' : 'Son'}
            </button>
          )}
          <Link
            to="/tableau-de-bord"
            title="Quitter le Grand Écran"
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" /> Quitter
          </Link>
        </div>
      </header>

      {/* Deux univers côte à côte, lus exactement de la même façon : compteurs,
          podium, classement, fil en direct. Le commerce à gauche — inchangé dans
          son fonctionnement — et les contacts des ateliers à droite. */}
      <div
        className="relative z-10 grid grid-cols-12 gap-5 px-6 pb-5 pt-1"
        style={{ height: 'calc(100vh - 88px)' }}
      >
        {/* ---------- Moitié COMMERCE ---------- */}
        <section className="col-span-6 flex min-h-0 flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-wider text-white">
              <Trophy className="h-6 w-6 text-gd-orange" />
              {phase === 'sprint' ? 'Commerce — RDV pris' : 'Commerce — ventes'}
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gd-orange">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gd-orange" /> Temps réel
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {phase === 'sprint' ? (
              <>
                <ProgressRing value={sprintRdvCount} max={objRdv} size={96} stroke={9} label="RDV Sprint" sublabel="obj." />
                <Compteur Icone={CalendarCheck} valeur={sprintCommercialCount} libelle="Matériel" couleur="text-white" fond="bg-gd-navy/40" />
                <Compteur Icone={Satellite} valeur={sprintAgriCount} libelle="Agri. précision" couleur="text-emerald-400" fond="bg-emerald-500/15" />
              </>
            ) : (
              <>
                <ProgressRing value={exacts?.ventes?.validees ?? ventesValidees.length} max={params?.objectif_ventes || 50} size={96} stroke={9} label="Ventes" sublabel="obj." />
                <Compteur Icone={Trophy} valeur={ventesValidees.length} libelle="Validées" couleur="text-white" fond="bg-gd-navy/40" />
                <Compteur Icone={Target} valeur={ventes.filter((v) => v.statut_validation === 'À valider').length} libelle="À valider" couleur="text-gd-orange" fond="bg-gd-orange/15" />
              </>
            )}
          </div>

          <BlocClassement
            liste={phase === 'sprint' ? leaderboard : ventesLeaderboard}
            unite={phase === 'sprint' ? 'RDV' : 'ventes'}
            abrege
            prevRanks={prevRanks}
            vide="En attente du premier RDV…"
          />

          <div className="shrink-0">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Derniers RDV
            </h3>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {liveFeed.length === 0 ? (
                  <p className="py-3 text-center text-sm text-white/40">Pas encore de RDV enregistré.</p>
                ) : (
                  liveFeed.slice(0, 3).map((rdv) => (
                    <FeedItem
                      key={rdv.id}
                      rdv={rdv}
                      clientName={clients[rdv.client_id]?.raison_sociale}
                      userName={nameMap[rdv.commercial_id]}
                      isNew={recentEvent?.data?.id === rdv.id}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ---------- Moitié ATELIERS ---------- */}
        <section className="col-span-6 flex min-h-0 flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-wider text-white">
              <Wrench className="h-6 w-6 text-gd-orange" /> Ateliers — contacts et RDV
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gd-orange">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gd-orange" /> Temps réel
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <ProgressRing value={atelier.contactes} max={atelier.cibles || 1} size={96} stroke={9} label="Contacts" sublabel="ciblés" />
            <Compteur Icone={Clock} valeur={atelier.rdv_pris || 0} libelle="RDV posés" couleur="text-gd-orange" fond="bg-gd-orange/15" />
            <Compteur Icone={CalendarCheck} valeur={atelier.ok} libelle="OK pour un RDV" couleur="text-white" fond="bg-gd-navy/40" />
            <Compteur Icone={Target} valeur={atelier.restants} libelle="À contacter" couleur="text-white" fond="bg-gd-navy/40" />
          </div>

          <BlocClassement
            liste={classementAteliers}
            unite="contacts"
            prevRanks={prevRangsAtelier}
            vide="En attente du premier contact atelier…"
          />

          <div className="shrink-0">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Derniers contacts
            </h3>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {contactsAtelier.length === 0 ? (
                  <p className="py-3 text-center text-sm text-white/40">Pas encore de contact atelier.</p>
                ) : (
                  contactsAtelier.slice(0, 3).map((contact) => (
                    <LigneContactAtelier key={contact.id} contact={contact} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>

      {/* New RDV celebration banner */}
      <AnimatePresence>
        {recentEvent && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-gd-orange px-8 py-4 shadow-2xl"
          >
            <Sparkles className="h-6 w-6 text-gd-navy-dark" />
            <span className="text-lg font-extrabold text-gd-navy-dark uppercase tracking-wide">
              Nouveau RDV ! {clients[recentEvent.data?.client_id]?.raison_sociale || ''}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo switcher */}
      {demoMode && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-1.5">
          <span className="text-xs text-white/50 px-2 font-medium">Démo :</span>
          {[
            { key: 'sprint', label: 'Sprint RDV' },
            { key: 'ventes', label: 'Ventes' }
          ].map(m => (
            <a key={m.key} href={`/grand-ecran?demo=${m.key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                demoMode.key === m.key ? 'bg-gd-orange text-gd-navy-dark' : 'text-white/60 hover:bg-white/10'
              }`}>
              {m.label}
            </a>
          ))}
          <a href="/grand-ecran" className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:bg-white/10 transition-colors">
            Arrêter la démo
          </a>
        </div>
      )}
    </div>
  );
}