// Les familles de matériel de l'opération, dans l'ordre du tableau de suivi
// historique. Partagées par la page interne et par la vue publique : une seule
// liste, donc deux tableaux qui ne peuvent pas diverger.
//
// Les visuels sont portés par MachineIcone — photo produit quand elle existe,
// silhouette dessinée sinon. Round et Big, regroupées ailleurs sous
// « presses », se distinguent ici par la forme de leurs bottes.
export const MACHINES = [
  { cle: 'Tracteur', court: 'TR', libelle: 'Tracteurs' },
  { cle: 'Télescopique', court: 'TÉL', libelle: 'Télescopiques' },
  { cle: 'Moissonneuse', court: 'MB', libelle: 'Moissonneuses' },
  { cle: 'Ensileuse', court: 'EN', libelle: 'Ensileuses' },
  { cle: 'Round Baler', court: 'RD', libelle: 'Round balers' },
  { cle: 'Big Baler', court: 'BG', libelle: 'Big balers' },
  { cle: 'Machine à vendanger', court: 'MAV', libelle: 'Machines à vendanger' },
  { cle: 'Agri. précision', court: 'AGP', libelle: 'Agri. précision' }
];

export default MACHINES;
