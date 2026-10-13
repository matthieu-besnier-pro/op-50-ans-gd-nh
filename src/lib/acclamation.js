/**
 * Acclamation du Grand Écran : applaudissements à chaque rendez-vous.
 *
 * Trois sources, par ordre de préférence :
 *   1. URL_SON ci-dessous, si renseignée — un lien DIRECT vers un fichier
 *      audio (.mp3, .ogg, .wav) ; l'adresse d'une page web ne convient pas ;
 *   2. le fichier `public/sons/acclamation.mp3`, s'il a été déposé ;
 *   3. à défaut, une synthèse par l'API Web Audio, qui ne demande aucun réseau.
 *
 * Pour un événement en salle, le fichier déposé reste le choix le plus sûr :
 * il ne dépend ni du réseau, ni de la disponibilité d'un hébergeur tiers.
 *
 * La lecture passe par un élément <audio> plutôt que par decodeAudioData : un
 * fichier distant serait sinon refusé faute d'en-têtes CORS.
 */

// Lien direct vers un fichier audio. Laisser vide pour utiliser le fichier
// déposé dans public/sons/, ou la synthèse.
const URL_SON = '';

const CLE_SOURDINE = 'cockpit.grandecran.sourdine';
// Deux rendez-vous coup sur coup ne doivent pas se superposer en vacarme.
const ECART_MINIMAL = 1200;

let ctx = null;
let applaudissements = null; // AudioBuffer synthétisé, construit une seule fois
let lecteur = null;          // HTMLAudioElement : fichier déposé ou URL
let lecteurPret = false;
let dernierJoue = 0;

/* ---------- Préférence de l'utilisateur ---------- */

export function enSourdine() {
  try {
    return localStorage.getItem(CLE_SOURDINE) === '1';
  } catch {
    return false;
  }
}

export function basculerSourdine() {
  const nouvelle = !enSourdine();
  try {
    localStorage.setItem(CLE_SOURDINE, nouvelle ? '1' : '0');
  } catch {
    /* navigation privée : la préférence vivra le temps de la session */
  }
  return nouvelle;
}

/* ---------- Contexte audio ---------- */

function contexte() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function sonDebloque() {
  return lecteurPret || (!!ctx && ctx.state === 'running');
}

/** Ce qui sera réellement joué — utile pour le dire à l'écran. */
export function sourceSon() {
  if (lecteurPret) return URL_SON ? 'lien' : 'fichier';
  return ctx && ctx.state === 'running' ? 'synthese' : 'aucune';
}

function adresseFichier() {
  if (URL_SON) return URL_SON;
  // L'application peut être servie sous un sous-chemin : on part de sa base.
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${base}sons/acclamation.mp3`;
}

/**
 * Les navigateurs refusent tout son tant que personne n'a cliqué sur la page.
 * À appeler depuis un vrai geste de l'utilisateur, une fois par projection.
 */
export async function debloquerSon() {
  // Le fichier d'abord : un vrai enregistrement sonnera toujours mieux.
  await preparerLecteur();

  const c = contexte();
  if (c) {
    try {
      await c.resume();
    } catch {
      /* ignore : l'état est vérifié juste après */
    }
    // Le tampon se fabrique ici, pas à la première salve : sa construction
    // prend quelques dizaines de millisecondes, de quoi décaler les confettis
    // du son qu'on vient justement de synchroniser. Inutile si un fichier joue.
    if (!lecteurPret && !applaudissements && c.state === 'running') {
      applaudissements = construireApplaudissements(c);
    }
  }
  return sonDebloque();
}

async function preparerLecteur() {
  if (lecteur) return;
  try {
    lecteur = new Audio(adresseFichier());
    lecteur.preload = 'auto';
    lecteur.volume = 0.9;
    // Déblocage : on lance puis on arrête aussitôt, pendant le geste de
    // l'utilisateur. Fichier absent ou lecture refusée → play() échoue, et la
    // synthèse prend le relais.
    await lecteur.play();
    lecteur.pause();
    lecteur.currentTime = 0;
    lecteurPret = true;
  } catch {
    lecteurPret = false;
  }
}

/* ---------- Synthèse ---------- */

/**
 * Applaudissements : une foule, c'est une multitude de claquements brefs.
 * On les sème dans un tampon, plus denses au début — une salle part d'un coup
 * puis s'éteint — sur un léger souffle qui les lie entre eux.
 */
function construireApplaudissements(c) {
  const duree = 2.6;
  const n = Math.floor(c.sampleRate * duree);
  const buf = c.createBuffer(2, n, c.sampleRate);

  for (let canal = 0; canal < 2; canal++) {
    const d = buf.getChannelData(canal);

    // Fond de salle.
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.015;

    // Claquements. L'exposant penche la répartition vers le début.
    for (let k = 0; k < 2600; k++) {
      const debut = Math.floor(Math.pow(Math.random(), 1.6) * (n - 400));
      const longueur = 60 + Math.floor(Math.random() * 180);
      const force = 0.25 + Math.random() * 0.75;
      for (let i = 0; i < longueur; i++) {
        d[debut + i] += (Math.random() * 2 - 1) * force * Math.exp(-i / (longueur * 0.28)) * 0.12;
      }
    }

    // Enveloppe générale : montée vive, longue retombée.
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] *= t < 0.06 ? t / 0.06 : Math.pow(1 - (t - 0.06) / 0.94, 1.5);
    }

    // Une foule de claquements isolés donne un signal très pointu : fort en
    // crête, mais inaudible dans une salle. On normalise, puis une saturation
    // douce redresse le corps du son sans jamais écrêter (mesuré : crête 0,96,
    // RMS -18 dBFS, là où le brut plafonnait à -35).
    let pic = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > pic) pic = a; }
    if (pic > 0) {
      for (let i = 0; i < n; i++) d[i] = Math.tanh((d[i] / pic) * 2);
    }
  }
  return buf;
}

/**
 * Sifflet de supporter. Le vibrato est ce qui le distingue d'une sirène :
 * sans lui, le glissando sonne mécanique.
 */
function sifflet(c, sortie, depart, duree, deHz, versHz) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const lfo = c.createOscillator();
  const profondeur = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(deHz, depart);
  osc.frequency.exponentialRampToValueAtTime(versHz, depart + duree * 0.55);
  osc.frequency.exponentialRampToValueAtTime(deHz * 1.1, depart + duree);

  lfo.frequency.value = 5.5;
  profondeur.gain.value = 28;
  lfo.connect(profondeur);
  profondeur.connect(osc.frequency);

  gain.gain.setValueAtTime(0.0001, depart);
  gain.gain.linearRampToValueAtTime(0.18, depart + 0.07);
  gain.gain.setValueAtTime(0.18, depart + duree * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, depart + duree);

  osc.connect(gain);
  gain.connect(sortie);

  osc.start(depart);
  osc.stop(depart + duree + 0.05);
  lfo.start(depart);
  lfo.stop(depart + duree + 0.05);
}

/* ---------- Lecture ---------- */

export function jouerAcclamation() {
  if (enSourdine()) return false;

  const maintenant = Date.now();
  if (maintenant - dernierJoue < ECART_MINIMAL) return false;

  if (lecteurPret && lecteur) {
    dernierJoue = maintenant;
    try {
      lecteur.currentTime = 0;
      const lecture = lecteur.play();
      // Un refus de lecture ne doit pas interrompre la salve visuelle.
      if (lecture && lecture.catch) lecture.catch(() => {});
      return true;
    } catch {
      /* on retombe sur la synthèse */
    }
  }

  const c = contexte();
  if (!c || c.state !== 'running') return false;
  dernierJoue = maintenant;

  const t = c.currentTime;
  const maitre = c.createGain();
  maitre.gain.value = 0.75;
  maitre.connect(c.destination);

  if (!applaudissements) applaudissements = construireApplaudissements(c);
  const source = c.createBufferSource();
  source.buffer = applaudissements;
  // Un passe-bande recentre le bruit là où claquent les mains.
  const bande = c.createBiquadFilter();
  bande.type = 'bandpass';
  bande.frequency.value = 1600;
  bande.Q.value = 0.6;
  source.connect(bande);
  bande.connect(maitre);
  source.start(t);

  sifflet(c, maitre, t + 0.15, 0.70, 700, 1500);
  sifflet(c, maitre, t + 0.75, 0.55, 850, 1700);
  return true;
}

export default jouerAcclamation;
