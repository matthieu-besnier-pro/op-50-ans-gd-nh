import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { avecReprise } from '../../shared/debit.ts';
import { routageRdv } from '../../shared/atelier.ts';

// Suivi des ventes — version PUBLIQUE, consultable sans compte.
//
// Cette fonction ne vérifie volontairement aucune authentification : c'est ce
// qui permet d'ouvrir le tableau de marche à qui reçoit le lien, sans lui
// demander de créer un compte.
//
// Elle livre le tableau de marche complet : agrégats, et déclarations avec leur
// client. C'est un choix assumé de la Direction — la page est ouverte à qui a
// le lien, donc les raisons sociales le sont aussi.
//
// Elle ne lit en revanche QUE les clients cités par une vente, pas le fichier
// entier : une page rafraîchie en continu n'a pas à balayer la base.

const CHUNK = 2000;
const MAX_PAGES = 10;

async function lireTout(fetchPage) {
  const out = [];
  const vus = new Set();
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await avecReprise(() => fetchPage(i * CHUNK));
    if (!Array.isArray(page) || page.length === 0) break;
    let nouveaux = 0;
    page.forEach((r) => { if (!vus.has(r.id)) { vus.add(r.id); out.push(r); nouveaux += 1; } });
    if (page.length < CHUNK || nouveaux === 0) break;
  }
  return out;
}

// Les comptes portent souvent pour nom l'identifiant de leur adresse : on le
// rend lisible, ce tableau étant fait pour être projeté et partagé.
const joliNom = (v) => {
  const t = String(v || '').trim();
  if (!t || t.includes(' ')) return t;
  const mots = t.split(/[._-]+/).filter(Boolean);
  if (mots.length < 2) return t;
  const nom = mots.pop().toUpperCase();
  return `${mots.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join('-')} ${nom}`;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const [ventes, rdvs, structure, users, bases, paramsListe] = await Promise.all([
      lireTout((skip) => sr.entities.vente.list('id', CHUNK, skip)),
      lireTout((skip) => sr.entities.rdv.list('id', CHUNK, skip)),
      avecReprise(() => sr.entities.structure_commerciale.list('-nom_commercial', 500)).catch(() => []),
      avecReprise(() => sr.entities.User.list('-created_date', 500)).catch(() => []),
      avecReprise(() => sr.entities.base.list('nom', 200)).catch(() => []),
      avecReprise(() => sr.entities.parametres_operation.list('-created_date', 1)).catch(() => [])
    ]);

    const p = paramsListe[0] || {};
    const opDebut = p.date_debut_operation || null;
    const opFin = p.date_fin_operation || null;

    // Nom affichable d'un vendeur : sa fiche de secteur d'abord, son compte sinon.
    const nomPar = {};
    (users || []).forEach((u) => { if (u.full_name) nomPar[u.id] = joliNom(u.full_name); });
    (structure || []).forEach((f) => { if (f.user_id && f.nom_commercial) nomPar[f.user_id] = f.nom_commercial; });

    // Répartition par MARQUE reprise : « Sans reprise » d'un côté, New Holland
    // de l'autre, et chaque marque concurrente pour elle-même. On regroupe sans
    // tenir compte de la casse — « john deere » et « John Deere » sont la même
    // marque — en gardant l'orthographe la plus fréquente.
    const marques = {};
    const compterMarque = (v) => {
      let libelle;
      if (v.reprise === 'Reprise NH') libelle = 'New Holland';
      else if (v.reprise === 'Reprise autre marque') libelle = String(v.marque_reprise || '').trim() || 'Marque non précisée';
      else if (v.reprise === 'Sans reprise') libelle = 'Sans reprise';
      else return;
      const cle = libelle.toLowerCase();
      const e = (marques[cle] = marques[cle] || { libelle, n: 0, formes: {} });
      e.n += 1;
      e.formes[libelle] = (e.formes[libelle] || 0) + 1;
      if (e.formes[libelle] > (e.formes[e.libelle] || 0)) e.libelle = libelle;
    };
    const parMarqueReprise = () => Object.values(marques)
      .sort((a, b) => b.n - a.n)
      .reduce((acc, e) => { acc[e.libelle] = e.n; return acc; }, {});

    const declarations = [];
    const parVendeur = {};
    const parMachine = {};
    const parTypeVente = {};
    const parReprise = {};
    let total = 0;
    let validees = 0;

    // Rythme jour par jour, sur la date que le vendeur a annoncée. C'est la
    // courbe qui dit si l'opération tient son allure ou si elle s'essouffle.
    const suiviParJour = {};

    ventes.forEach((v) => {
      const machine = v.type_machine || 'Autre';
      const jour = String(v.date_vente || '').slice(0, 10);
      if (jour) suiviParJour[jour] = (suiviParJour[jour] || 0) + 1;
      const validee = v.statut_validation === 'Validé';
      total += 1;
      if (validee) validees += 1;
      parMachine[machine] = (parMachine[machine] || 0) + 1;
      parTypeVente[v.type_vente || 'Non précisé'] = (parTypeVente[v.type_vente || 'Non précisé'] || 0) + 1;
      parReprise[v.reprise || 'Non précisé'] = (parReprise[v.reprise || 'Non précisé'] || 0) + 1;
      compterMarque(v);
      // La déclaration figure dans la liste même sans vendeur attribué : c'est
      // justement celle-là qu'il faut voir pour la rattraper.
      declarations.push({
        id: v.id,
        date: v.date_vente || '',
        vendeur: (v.commercial_id && nomPar[v.commercial_id]) || v.commercial_nom || '',
        client_id: v.client_id || '',
        machine: v.type_machine || '',
        modele: v.modele || '',
        type_vente: v.type_vente || '',
        reprise: v.reprise || '',
        marque_reprise: v.marque_reprise || '',
        validee
      });

      // Un vendeur sans compte compte comme les autres, sous son nom.
      const cleVendeur = v.commercial_id || (v.commercial_nom ? `nom:${v.commercial_nom}` : '');
      if (!cleVendeur) return;
      const e = (parVendeur[cleVendeur] = parVendeur[cleVendeur]
        || {
          nom: (v.commercial_id && nomPar[v.commercial_id]) || v.commercial_nom || 'Vendeur',
          machines: {}, total: 0, validees: 0
        });
      e.machines[machine] = (e.machines[machine] || 0) + 1;
      e.total += 1;
      if (validee) e.validees += 1;
    });

    // Raison sociale des seuls clients cités par une vente, lue par paquets.
    const idsClients = [...new Set(declarations.map((d) => d.client_id).filter(Boolean))];
    const nomClient = {};
    for (let i = 0; i < idsClients.length; i += 50) {
      const lot = await avecReprise(() => sr.entities.client
        .filter({ id: { $in: idsClients.slice(i, i + 50) } }, 'id', 50)).catch(() => []);
      (lot || []).forEach((c) => { nomClient[c.id] = c.raison_sociale || ''; });
    }
    declarations.forEach((d) => {
      d.client = nomClient[d.client_id] || '';
      delete d.client_id;
    });

    // Les rendez-vous en regard des ventes, pour le taux de transformation.
    // Ceux des ateliers relèvent du suivi SAV et n'entrent pas dans ce calcul.
    const { estAtelier } = routageRdv(bases, users);
    let rdvMateriel = 0;
    let rdvAgri = 0;
    rdvs.forEach((r) => {
      if (r.statut === 'Annulé' || estAtelier(r)) return;
      const jour = (r.created_date || r.date_heure || '').slice(0, 10);
      if (opDebut && opFin && !(jour >= opDebut && jour <= opFin)) return;
      if (r.type === 'RDV agri. précision') rdvAgri += 1;
      else if (r.type !== 'RDV atelier hivernage') rdvMateriel += 1;
    });

    const NOM_VENDEUR = (v) => (v.commercial_id && nomPar[v.commercial_id]) || v.commercial_nom || '';
    // Deux horodatages, qu'il ne faut surtout pas confondre.
    //
    // La DERNIÈRE DÉCLARATION est celle dont la date de vente est la plus
    // récente : c'est l'ordre dans lequel les vendeurs les annoncent sur le
    // groupe, et donc celui qu'ils reconnaissent. Trier sur la date d'import
    // donnerait un autre gagnant à chaque rattrapage de saisie.
    //
    // L'heure d'INTÉGRATION est celle du dernier import, tous enregistrements
    // confondus. Elle dit jusqu'où le tableau est à jour : une vente annoncée
    // sur WhatsApp après cette heure n'est pas encore comptée.
    const derniere = ventes
      .filter((v) => v.date_vente)
      .sort((a, b) => {
        const parDate = String(b.date_vente).localeCompare(String(a.date_vente));
        // Même jour : la dernière arrivée tranche.
        return parDate !== 0 ? parDate : String(b.created_date || '').localeCompare(String(a.created_date || ''));
      })[0] || null;
    const integreLe = ventes.reduce((max, v) => (v.created_date > max ? v.created_date : max), '');
    const derniereDeclaration = derniere ? {
      integre: integreLe,
      quand: derniere.date_vente || '',
      vendeur: NOM_VENDEUR(derniere),
      machine: derniere.type_machine || '',
      modele: derniere.modele || ''
    } : null;

    return Response.json({
      operation: p.nom_operation || '',
      date_debut: opDebut || '',
      date_fin: opFin || '',
      maj: new Date().toISOString(),
      suivi: {
        total,
        validees,
        par_commercial: parVendeur,
        par_machine: parMachine,
        par_type_vente: parTypeVente,
        par_reprise: parReprise,
        par_marque_reprise: parMarqueReprise(),
        derniere_declaration: derniereDeclaration,
        par_jour: suiviParJour,
        rdv: { materiel: rdvMateriel, agri: rdvAgri },
        declarations: declarations
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, 300)
      }
    });
  } catch (error) {
    return Response.json({ error: `[suivi_ventes_public] ${error?.message || String(error)}` }, { status: 500 });
  }
}
