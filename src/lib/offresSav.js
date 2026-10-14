// Offres SAV de l'opération 50 ans : ce sont les OP des fichiers atelier.
export const OFFRES_SAV = ['INSPECTION ANNUELLE', 'REVISION', 'CONTRAT DE SERVICE'];

const META = {
  'INSPECTION ANNUELLE': { emoji: '🔍', puce: 'border-sky-300 bg-sky-50 text-sky-700', carte: 'border-sky-300 bg-sky-50 text-sky-800' },
  REVISION: { emoji: '🛠️', puce: 'border-indigo-300 bg-indigo-50 text-indigo-700', carte: 'border-indigo-300 bg-indigo-50 text-indigo-800' },
  'CONTRAT DE SERVICE': { emoji: '📋', puce: 'border-teal-300 bg-teal-50 text-teal-700', carte: 'border-teal-300 bg-teal-50 text-teal-800' }
};

const DEFAUT = { emoji: '🔧', puce: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700', carte: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800' };

export const metaOffre = (offre) => META[offre] || DEFAUT;

// Libellé lisible : « CONTRAT DE SERVICE » → « Contrat de service ».
export const labelOffre = (offre) => (offre ? offre.charAt(0) + offre.slice(1).toLowerCase() : '');