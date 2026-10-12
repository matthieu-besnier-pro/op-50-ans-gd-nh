// Clé de comparaison des noms : accents, casse, ponctuation et ordre des mots ignorés.
// Sert au rattachement des référents d'atelier (fiches commerciales ↔ noms des tableaux sources).
export const normNom = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();