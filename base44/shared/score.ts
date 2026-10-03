// Pure score d'appétence logic — shared between backend functions.
// A: délai avant prochain achat (40 max)
// B: nb machines avec achat dans 12 mois (25 max)
// C: proximité fin de vie (15 max)
// D: capacité financière / PAC (20 max) — forcé à 20 si CUMA ou ETA
//
// Le parc importé (fichiers d'immatriculations) n'a pas de prédiction SIV :
// on dérive alors la date de renouvellement et la fin de vie de la 1re immatriculation.

const AGE_RENOUVELLEMENT = 8; // années : âge à partir duquel une machine est renouvelable
const AGE_FIN_DE_VIE = 12; // années

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function immatDate(m) {
  if (m.premiere_immat) {
    const d = new Date(m.premiere_immat);
    if (!isNaN(d.getTime())) return d;
  }
  if (m.annee_immat) return new Date(Date.UTC(Number(m.annee_immat), 0, 1));
  return null;
}

function plusAns(date, ans) {
  return new Date(date.getTime() + ans * 365.25 * 86400000).toISOString();
}

// Date d'achat prévu : donnée SIV si elle existe, sinon 1re immat. + 8 ans.
export function prochainAchat(m) {
  if (m.prochain_achat) return m.prochain_achat;
  const immat = immatDate(m);
  return immat ? plusAns(immat, AGE_RENOUVELLEMENT) : null;
}

// Fin de vie estimée : donnée SIV si elle existe, sinon 1re immat. + 12 ans.
export function dateFinDeVie(m) {
  if (m.date_fin_vie) return m.date_fin_vie;
  const immat = immatDate(m);
  return immat ? plusAns(immat, AGE_FIN_DE_VIE) : null;
}

export function scoreA(materiels, now = new Date()) {
  // Une échéance dépassée = renouvellement immédiat (délai 0).
  const delays = materiels
    .map((m) => daysUntil(prochainAchat(m), now))
    .filter((d) => d !== null)
    .map((d) => Math.max(0, d));
  if (delays.length === 0) return 0;
  const min = Math.min(...delays);
  if (min <= 90) return 40;
  if (min <= 180) return 28;
  if (min <= 365) return 16;
  if (min <= 730) return 8;
  return 0;
}

export function scoreB(materiels, now = new Date()) {
  const count = materiels.filter((m) => {
    const d = daysUntil(prochainAchat(m), now);
    return d !== null && Math.max(0, d) <= 365;
  }).length;
  if (count === 0) return 0;
  if (count === 1) return 12;
  if (count === 2) return 20;
  return 25;
}

export function scoreC(materiels, now = new Date()) {
  const delays = materiels
    .map((m) => daysUntil(dateFinDeVie(m), now))
    .filter((d) => d !== null)
    .map((d) => Math.max(0, d));
  if (delays.length === 0) return 0;
  const min = Math.min(...delays);
  if (min <= 180) return 15;
  if (min <= 365) return 8;
  return 0;
}

export function scoreD(client) {
  if (client.beneficiaire_pac_certain) return 20;
  if (!client.usage_pac_autorise) return 0;
  const m = client.montant_pac;
  if (m == null || isNaN(m)) return 0;
  if (m >= 70000) return 20;
  if (m >= 40000) return 12;
  if (m >= 15000) return 6;
  return 0;
}

export function computeScore(client, materiels, now = new Date()) {
  const a = scoreA(materiels, now);
  const b = scoreB(materiels, now);
  const c = scoreC(materiels, now);
  const d = scoreD(client);
  const total = a + b + c + d;
  let niveau = "Faible";
  if (total >= 66) niveau = "Fort";
  else if (total >= 36) niveau = "Moyen";
  return { score: total, niveau };
}

// Détection du type de structure à l'import
export function detectTypeStructure(raisonSociale, activiteNaf) {
  const rs = (raisonSociale || "").trim().toUpperCase().replace(/^\*/, "").trim();
  if (rs.startsWith("CUMA")) return "CUMA";
  if ((activiteNaf || "").trim() === "01.61Z") return "ETA";
  if (rs.includes("SARL") || rs.includes("SAS") || rs.includes("SA ") || rs.includes("EURL") || rs.includes("SCI")) return "Autre société";
  return "Exploitation";
}

export function isBeneficiairePacCertain(typeStructure) {
  return typeStructure === "CUMA" || typeStructure === "ETA";
}