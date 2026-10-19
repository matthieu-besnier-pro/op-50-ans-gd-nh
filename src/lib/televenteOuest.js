// Télévente HUILE & GRAISSE — secteur Ouest.
//
// Relevé de la campagne, saisi tel quel depuis le tableau de la télévente. Ces
// chiffres ne viennent pas de l'outil : aucune de ces ventes n'est déclarée sur
// le groupe WhatsApp, elles sont prises par téléphone sur un autre canal. Les
// mettre en dur est donc le reflet exact de la source, pas un raccourci — pour
// les mettre à jour, on remplace les lignes ci-dessous.
//
// Les quantités sont des nombres de contenants ; le total est en kilogrammes,
// un carton et un fût ne pesant évidemment pas la même chose.

export const COLONNES = [
  { cle: 'carton', libelle: 'Carton de graisse', famille: 'GRAISSE' },
  { cle: 'tonnelet25', libelle: 'Tonnelet 25 kg', famille: 'GRAISSE' },
  { cle: 'tonnelet50', libelle: 'Tonnelet 50 kg', famille: 'GRAISSE' },
  { cle: 'surpresseur', libelle: 'Surpresseur 74038', famille: 'GRAISSE' },
  { cle: 'bidon20', libelle: 'Bidon 20 L', famille: 'HUILE SHELL & LUBEXCEL' },
  { cle: 'bidon55', libelle: 'Bidon 55 L', famille: 'HUILE SHELL & LUBEXCEL' },
  { cle: 'bidon60', libelle: 'Bidon 60 L', famille: 'HUILE SHELL & LUBEXCEL' },
  { cle: 'fut209', libelle: 'Fût 209 L', famille: 'HUILE SHELL & LUBEXCEL' },
  { cle: 'vrac', libelle: 'Vrac', famille: 'HUILE SHELL & LUBEXCEL' },
  { cle: 'adb', libelle: 'ADB LG LR', famille: 'HUILE SHELL & LUBEXCEL' }
];

// Une ligne par vendeur, rattachée à son point de vente. Un point de vente peut
// en compter plusieurs — La Peyratte, Sauzé et La Ferrière en ont deux.
//
// La Peyratte regroupe ce que le relevé notait séparément sous Vasles et
// Châtillon/Thouet : c'est un seul point de vente.
export const LIGNES = [
  { site: 'La Peyratte', vendeur: 'Gabriel JOUSSELIN', carton: 6, bidon20: 5, bidon55: 5, bidon60: 3, fut209: 9, kg: 2496 },
  { site: 'Niort', vendeur: 'Maxime DEBORDE', carton: 8, tonnelet50: 3, bidon20: 15, bidon55: 11, fut209: 12, kg: 3643 },
  { site: 'St Martin les Melle', vendeur: 'Alisson MOTILLON', carton: 14, bidon20: 22, bidon60: 26, fut209: 11, kg: 4433.4 },
  { site: 'La Peyratte', vendeur: 'Timothé TALBOT', carton: 13, tonnelet50: 2, bidon20: 20, bidon60: 2, fut209: 6, kg: 1998.8 },
  { site: 'Sauzé', vendeur: 'Clément BLANCHARD', carton: 15, tonnelet50: 2, bidon20: 12, bidon55: 13, fut209: 13, kg: 3916 },
  { site: 'Sauzé', vendeur: 'Sébastien GRATRAUD', carton: 8, bidon20: 8, bidon55: 5, bidon60: 1, fut209: 7, kg: 2034.8 },
  { site: 'La Ferrière', vendeur: 'Benoît REAULT', carton: 5, bidon20: 20, bidon55: 8, fut209: 11, kg: 3187 },
  { site: 'La Ferrière', vendeur: 'Tony TEXIER', carton: 5, bidon20: 14, bidon55: 3, bidon60: 1, fut209: 3, kg: 1180 },
  { site: 'Naintré', vendeur: 'Hantz MULLER', carton: 2, bidon20: 6, bidon55: 3, bidon60: 3, fut209: 17, kg: 4037.2 },
  { site: 'Chasseneuil-sur-Bonnieure', vendeur: 'Jean-Batiste GALLAND', carton: 11, bidon20: 31, bidon55: 17, bidon60: 1, fut209: 8, kg: 3392.6 }
];

// Regroupement par point de vente, du plus gros au plus petit. Un magasin qui
// compte deux magasiniers — Sauzé, La Ferrière — ne fait qu'une ligne : leurs
// quantités s'additionnent, c'est le point de vente qu'on suit, pas la personne.
export function parPointDeVente() {
  const sites = new Map();
  LIGNES.forEach((l) => {
    const e = sites.get(l.site) || { site: l.site, kg: 0 };
    e.kg += l.kg || 0;
    COLONNES.forEach(({ cle }) => { if (l[cle]) e[cle] = (e[cle] || 0) + l[cle]; });
    sites.set(l.site, e);
  });
  return [...sites.values()].sort((a, b) => b.kg - a.kg);
}

export const TOTAL_KG = LIGNES.reduce((s, l) => s + (l.kg || 0), 0);

export default LIGNES;
