// Certains numéros issus de l'import contiennent deux numéros collés dans la même valeur
// (ex. « 07626099580626640917 » = 07 62 60 99 58 + 06 26 64 09 17).
// On les sépare pour les afficher l'un sous l'autre.

// Un numéro français fait 10 chiffres : au-delà, on découpe par paquets de 10.
function decouper(chiffres) {
  if (chiffres.length < 9) return [];
  if (chiffres.length <= 11) return [chiffres];
  const out = [];
  for (let i = 0; i < chiffres.length; i += 10) {
    const bloc = chiffres.slice(i, i + 10);
    if (bloc.length >= 9) out.push(bloc);
  }
  return out;
}

// Liste des numéros contenus dans une valeur (séparateurs « / », « , », espaces, « ou »… puis numéros collés).
export function numerosTelephone(valeur) {
  if (valeur == null) return [];
  const texte = String(valeur).trim();
  if (!texte) return [];

  const numeros = [];
  const ajouter = (n) => { if (!numeros.includes(n)) numeros.push(n); };

  texte.split(/[/,;|]+|\s+|\bou\b|\bet\b/i).forEach((morceau) => {
    const chiffres = morceau.replace(/\D/g, '');
    if (chiffres.length >= 9) decouper(chiffres).forEach(ajouter);
  });

  if (numeros.length === 0) decouper(texte.replace(/\D/g, '')).forEach(ajouter);
  return numeros;
}

// Affichage lisible : 0686280708 → « 06 86 28 07 08 »
export function formatTelephone(numero) {
  const d = String(numero).replace(/\D/g, '');
  if (d.length === 10) return d.replace(/(\d{2})(?!$)/g, '$1 ');
  return String(numero);
}