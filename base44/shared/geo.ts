// Centroïdes approximatifs des départements français (métropole + Corse).
// Sert à placer un client dans le BON département à partir de son code postal,
// puis à valider/rejeter des coordonnées sources aberrantes.
export const DEPT_CENTROIDS = {
  "01": [46.1, 5.3], "02": [49.5, 3.6], "03": [46.4, 3.2], "04": [44.1, 6.2], "05": [44.7, 6.3],
  "06": [43.9, 7.2], "07": [44.8, 4.4], "08": [49.7, 4.7], "09": [42.9, 1.6], "10": [48.3, 4.2],
  "11": [43.1, 2.5], "12": [44.3, 2.6], "13": [43.5, 5.1], "14": [49.1, -0.3], "15": [45.0, 2.7],
  "16": [45.7, 0.2], "17": [45.8, -0.8], "18": [47.1, 2.5], "19": [45.3, 1.9], "21": [47.4, 4.8],
  "22": [48.4, -2.8], "23": [46.1, 2.0], "24": [45.1, 0.8], "25": [47.2, 6.4], "26": [44.7, 5.2],
  "27": [49.1, 1.0], "28": [48.4, 1.4], "29": [48.3, -4.0], "2A": [41.8, 9.0], "2B": [42.4, 9.2],
  "30": [43.9, 4.3], "31": [43.4, 1.3], "32": [43.7, 0.6], "33": [44.8, -0.6], "34": [43.6, 3.4],
  "35": [48.2, -1.7], "36": [46.8, 1.6], "37": [47.2, 0.7], "38": [45.3, 5.6], "39": [46.7, 5.8],
  "40": [44.0, -0.8], "41": [47.6, 1.3], "42": [45.7, 4.2], "43": [45.1, 3.8], "44": [47.3, -1.6],
  "45": [47.9, 2.3], "46": [44.6, 1.6], "47": [44.4, 0.6], "48": [44.5, 3.5], "49": [47.4, -0.5],
  "50": [49.1, -1.3], "51": [48.9, 4.2], "52": [48.1, 5.2], "53": [48.3, -0.6], "54": [48.8, 6.1],
  "55": [49.0, 5.4], "56": [47.8, -2.8], "57": [49.0, 6.6], "58": [47.1, 3.5], "59": [50.5, 3.2],
  "60": [49.4, 2.4], "61": [48.6, 0.1], "62": [50.5, 2.3], "63": [45.7, 3.1], "64": [43.3, -0.8],
  "65": [43.1, 0.1], "66": [42.6, 2.6], "67": [48.6, 7.6], "68": [47.9, 7.3], "69": [45.8, 4.6],
  "70": [47.6, 6.1], "71": [46.6, 4.5], "72": [48.0, 0.2], "73": [45.5, 6.4], "74": [46.0, 6.4],
  "75": [48.86, 2.35], "76": [49.7, 1.0], "77": [48.6, 3.0], "78": [48.8, 1.9], "79": [46.5, -0.3],
  "80": [49.9, 2.3], "81": [43.8, 2.1], "82": [44.0, 1.1], "83": [43.4, 6.2], "84": [44.0, 5.2],
  "85": [46.7, -1.4], "86": [46.6, 0.5], "87": [45.9, 1.3], "88": [48.2, 6.4], "89": [47.8, 3.6],
  "90": [47.6, 6.9], "91": [48.5, 2.2], "92": [48.9, 2.25], "93": [48.9, 2.5], "94": [48.8, 2.5],
  "95": [49.1, 2.2]
};

export function cpFromClient(c) {
  const adr = c.adresse_complete || "";
  const m = adr.match(/\b(\d{5})\b/);
  if (m) return m[1];
  if (/^\d{5}$/.test(c.code_commune || "")) return c.code_commune;
  return null;
}

export function deptFromClient(c) {
  const cp = cpFromClient(c);
  if (cp) {
    // Corse : 20xxx → 2A / 2B (approximation par tranche)
    if (cp.startsWith("20")) return parseInt(cp, 10) < 20200 ? "2A" : "2B";
    return cp.slice(0, 2);
  }
  if (c.departement) {
    const d = String(c.departement).trim().toUpperCase();
    if (d === "2A" || d === "2B") return d;
    const n = d.replace(/\D/g, "");
    if (n) return n.padStart(2, "0").slice(0, 2);
  }
  return null;
}

export function deptCentroid(dept) {
  return dept && DEPT_CENTROIDS[dept] ? DEPT_CENTROIDS[dept] : null;
}

// Une coordonnée est cohérente si elle est à moins de ~1.3° du centroïde du département.
export function coordDansDept(lat, lng, dept) {
  const c = deptCentroid(dept);
  if (!c) return true; // pas de référence → on ne rejette pas
  if (lat == null || lng == null) return false;
  return Math.hypot(lat - c[0], lng - c[1]) <= 1.3;
}
