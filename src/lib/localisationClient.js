// Localisation d'un client (code postal + ville).
// L'adresse des fichiers d'import se termine par « <CP> <VILLE> » :
//   « LE BOURG 16330 COULONGES », « ROUTE DE SAUZE VAUSSAIS 16240 VILLEFAGNAN ».
// On retient la dernière suite « 5 chiffres + libellé » de l'adresse.
const RE_LOCALISATION = /(\d{5})\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9'’\- ]*)/g;

export function localiserClient(client) {
  const adresse = String(client?.adresse_complete || '').trim();
  if (!adresse) return { code_postal: '', ville: '' };

  let code_postal = '';
  let ville = '';
  for (const m of adresse.matchAll(RE_LOCALISATION)) {
    code_postal = m[1];
    ville = m[2].trim();
  }
  return { code_postal, ville };
}

// « 16330 COULONGES » — chaîne vide si l'adresse ne porte pas de code postal.
export function villeClientTexte(client) {
  const { code_postal, ville } = localiserClient(client);
  return [code_postal, ville].filter(Boolean).join(' ');
}