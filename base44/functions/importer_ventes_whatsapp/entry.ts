import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Import des ventes déclarées sur le groupe WhatsApp — le commercial ne ressaisit rien.
// action = 'analyser' : extrait les ventes du texte collé (IA), rapproche le commercial par son nom.
// action = 'creer'    : crée les ventes revues, en statut « À valider ».

const MACHINES = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger', 'Agri. précision'];
const TYPES_VENTE = ['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris'];
const REPRISES = ['Sans reprise', 'Reprise NH', 'Reprise autre marque'];

const norm = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// ---- Horodatage des messages WhatsApp ----
//
// Un export WhatsApp préfixe chaque message de sa date et de son heure :
//
//   [13/10/2026 14:45:34] Jfrancois DRAGON: Vente T6.160 no 152054 …
//
// C'est CETTE heure qui fait foi — celle où le vendeur a annoncé sa vente,
// pas celle où quelqu'un a collé le texte dans l'outil, qui est la même pour
// tout un lot et ne distingue plus rien.
//
// Le préfixe est lu par expression régulière plutôt que par l'IA : un
// horodatage est une donnée exacte, et un modèle qui le reformule finit par
// en inventer un.
const LIGNE_HORODATEE = /^\s*\[?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?: |\s)*([AaPp][Mm])?\s*\]?\s*/;

// Heure locale française, sans suffixe de fuseau : l'export est déjà dans
// l'heure de ceux qui l'ont écrit, la convertir la décalerait.
const isoDepuis = (m) => {
  let [, j, mo, a, h, mi, sec, ampm] = m;
  let jour = Number(j), mois = Number(mo), annee = Number(a);
  // Export en MM/JJ : seul un premier nombre > 12 tranche avec certitude.
  if (jour <= 12 && mois > 12) { const t = jour; jour = mois; mois = t; }
  if (annee < 100) annee += 2000;
  let heure = Number(h);
  if (ampm) {
    const pm = ampm.toLowerCase() === 'pm';
    if (pm && heure < 12) heure += 12;
    if (!pm && heure === 12) heure = 0;
  }
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || heure > 23) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  return `${annee}-${p2(mois)}-${p2(jour)}T${p2(heure)}:${p2(Number(mi))}:${p2(Number(sec || 0))}`;
};

const cleTexte = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);

// Index des messages horodatés du texte collé. L'IA renvoie le message
// d'origine ; on le retrouve ici pour lui rendre son heure, même si elle a
// laissé tomber le préfixe en recopiant.
function indexerHorodatages(rawText) {
  const index = [];
  String(rawText || '').split(/\r?\n/).forEach((ligne) => {
    const m = ligne.match(LIGNE_HORODATEE);
    if (!m) return;
    const iso = isoDepuis(m);
    if (iso) index.push({ iso, cle: cleTexte(ligne.slice(m[0].length)) });
  });
  return index;
}

function horodatageDe(vente, index) {
  // Le préfixe est resté dans ce que l'IA a recopié : on le lit directement.
  for (const champ of [vente?.horodatage, vente?.texte_source]) {
    const m = String(champ || '').match(LIGNE_HORODATEE);
    if (m) { const iso = isoDepuis(m); if (iso) return iso; }
  }
  // Sinon on raccroche le message à sa ligne d'origine par son contenu.
  const cle = cleTexte(String(vente?.texte_source || '').replace(LIGNE_HORODATEE, ''));
  if (cle.length >= 12) {
    const trouve = index.find((e) => e.cle.includes(cle.slice(0, 40)) || cle.includes(e.cle.slice(0, 40)));
    if (trouve) return trouve.iso;
  }
  return '';
}

// Un numéro de MAT désigne une machine déjà immatriculée au parc Gonnin-Duris
// — matériel de démo, de location, de stock. Elle n'est donc pas commandée à
// New Holland pour l'occasion : c'est une vente sur stock maison.
//
// La règle ne s'applique qu'à DÉFAUT : un message qui annonce explicitement une
// nouvelle commande garde ce qu'il dit.
// « no », « n° », « nº » et « mat » désignent la même chose dans les messages :
// le numéro de la machine au parc. Les vendeurs abrègent comme ils veulent.
const RX_MAT = /\b(?:mat(?:ricule)?|n[°ºo]s?|num(?:[ée]ro)?)\.?\s*(?:mat\.?\s*)?\d{3,}/i;
const aNumeroDeMat = (...textes) => textes.some((t) => RX_MAT.test(String(t || '')));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'analyser';
    const sr = base44.asServiceRole;
    const today = new Date().toISOString().slice(0, 10);

    // ---------- ANALYSE (IA) ----------
    if (action === 'analyser') {
      const rawText = (body.raw_text || '').trim();
      if (!rawText) return Response.json({ error: 'Aucun texte à analyser' }, { status: 400 });

      const schema = {
        type: 'object',
        properties: {
          ventes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                texte_source: { type: 'string', description: 'La ligne d\'origine COMPLÈTE, horodatage entre crochets compris, recopiée sans rien changer' },
                horodatage: { type: 'string', description: 'Le préfixe horodaté de la ligne, recopié tel quel (ex. « [13/10/2026 14:45:34] »). Vide si la ligne n\'en a pas.' },
                commercial_nom: { type: 'string', description: 'Nom du commercial vendeur si identifiable' },
                client_nom: { type: 'string', description: 'Nom de l\'exploitation / client si mentionné' },
                modele: { type: 'string', description: 'Modèle exact annoncé : T6.160, T7.210, TH6.26, Roll-Belt 180, FR480… Vide si le message ne le donne pas.' },
                type_machine: { type: 'string', enum: MACHINES },
                type_vente: { type: 'string', enum: TYPES_VENTE },
                reprise: { type: 'string', enum: REPRISES },
                marque_reprise: { type: 'string', description: 'Marque reprise si reprise autre marque' },
                date_vente: { type: 'string', description: 'Date au format AAAA-MM-JJ si mentionnée, sinon vide' },
                quantite: { type: 'number', description: 'Nombre de machines vendues dans ce message (« 2 x T6.180 » = 2). 1 par défaut.' },
                hors_operation: { type: 'boolean', description: "Vrai si le matériel vendu ne fait pas partie de l'opération New Holland (outil de travail du sol, matériel d'une autre marque vendu seul)." },
                confiance: { type: 'string', enum: ['haute', 'moyenne', 'basse'] }
              }
            }
          }
        }
      };

      const prompt = `Tu analyses des messages d'un groupe WhatsApp de commerciaux agricoles (concession New Holland) qui déclarent leurs ventes de matériel en texte libre.
Extrais UNIQUEMENT les messages qui déclarent une vente réelle de machine (ignore les félicitations, blagues, questions, messages sans vente).
Pour chaque vente :
- modele : la référence exacte annoncée, sans le numéro de série ni le chargeur.
  « Vente T6.160 no 152054 » → « T6.160 ». « télescopique TH6.26 démo DBS mat 149068 »
  → « TH6.26 ». Vide si le message ne donne pas de modèle.
- type_machine : rattache au plus proche parmi ${MACHINES.join(', ')}.
  « Agri. précision » couvre le guidage et le GPS : Fleet Pro, Trimble, antenne,
  console, autoguidage, kit de précision.
- hors_operation : vrai quand le matériel vendu ne relève PAS de l'opération
  New Holland — un outil de travail du sol (vibroculteur, déchaumeur, charrue),
  ou du matériel d'une autre marque vendu seul. Ces ventes sont remontées mais
  décochées : elles ne comptent pas dans l'opération.
- type_vente : ${TYPES_VENTE.join(', ')}. LAISSE VIDE si le message ne le dit pas.
  EXCEPTION : un numéro de machine — « mat 149068 », « no 152054 », « n°97507 » —
  désigne un matériel déjà immatriculé au parc Gonnin-Duris : démo, location, stock.
  Mets alors « Stock Gonnin-Duris », sauf si le message annonce explicitement une
  nouvelle commande, auquel cas c'est elle qui l'emporte.
- reprise : ${REPRISES.join(', ')}. LAISSE VIDE si le message ne dit rien de la reprise.
  « Sans reprise » ne se met QUE si le message l'indique explicitement. Si une marque
  concurrente est reprise, mets « Reprise autre marque » et renseigne marque_reprise.
- N'invente jamais une valeur pour combler un trou : un champ vide sera complété à la
  main, une valeur fausse passerait inaperçue.
- commercial_nom : le vendeur si identifiable (auteur du message ou nom cité).
- client_nom : l'exploitation/client si mentionné, sinon vide.
- texte_source et horodatage : recopie la ligne SANS RIEN REFORMATER. Si elle commence
  par « [13/10/2026 14:45:34] », ces caractères doivent se retrouver à l'identique.
  Ne reformate jamais une date, ne la traduis pas, ne la complète pas.
- confiance : ton niveau de certitude sur l'extraction.
- quantite : le nombre de machines du message. « Vendu 2 x T6.180 » = 2, « vendu T7 » = 1.
  Un chargeur, un kit ou un équipement vendu AVEC une machine ne compte pas en plus.
Exemple de message : « T5.100 EC n°97507 avec chargeur Q4L n°98145 Reprise Valtra 6250 de 2000 » → Tracteur, Nouvelle commande, Reprise autre marque, marque_reprise Valtra.

Messages à analyser :
"""${rawText.slice(0, 12000)}"""`;

      // L'intégration est bloquée depuis le runtime applicatif : la plateforme
      // exige le service role. On l'appelle en méthode (sr.integrations.Core.X)
      // et non via une variable extraite, sinon l'intégration perd son « this ».
      // Appel LLM via le canal service : les intégrations Core ne s'exécutent pas
      // depuis le runtime applicatif, il n'y a donc pas de repli côté client.
      let llm;
      try {
        llm = await sr.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
      } catch (e) {
        return Response.json({ error: `Analyse IA indisponible : ${e?.message || e}` }, { status: 500 });
      }
      const ventes = (llm?.ventes || llm?.data?.ventes || []);
      const horodatages = indexerHorodatages(rawText);

      // Rapprochement du vendeur : comptes, fiches de secteur, et tableau de
      // répartition — ce dernier nomme aussi ceux qui n'ont jamais ouvert
      // l'outil, et dont la vente sera enregistrée à leur nom.
      const [users, structure, bases] = await Promise.all([
        sr.entities.User.list('-created_date', 300).catch(() => []),
        sr.entities.structure_commerciale.list('-nom_commercial', 300).catch(() => []),
        sr.entities.base.list('nom', 200).catch(() => [])
      ]);
      const commByName = new Map();
      for (const u of users) {
        if (u.full_name) commByName.set(norm(u.full_name), { commercial_id: u.id, nom: u.full_name });
      }
      for (const s of structure) {
        if (s.user_id && s.nom_commercial && !commByName.has(norm(s.nom_commercial))) {
          commByName.set(norm(s.nom_commercial), { commercial_id: s.user_id, nom: s.nom_commercial });
        }
      }
      for (const b of (bases || [])) {
        for (const nom of (b.commerciaux || [])) {
          if (nom && !commByName.has(norm(nom))) {
            commByName.set(norm(nom), { commercial_id: null, nom });
          }
        }
      }

      // Sur WhatsApp, chacun signe comme il veut : « Jo Bastier » pour Jonathan
      // BASTIER, « Jfrancois DRAGON » pour Jean-François. Le NOM DE FAMILLE est
      // le seul repère fiable — on s'en sert quand il ne désigne qu'une
      // personne, et on renonce plutôt que de deviner quand il y en a deux.
      const matchComm = (nom) => {
        if (!nom) return null;
        const n = norm(nom);
        if (commByName.has(n)) return commByName.get(n);

        // Rapprochement partiel : on ne retient que s'il ne désigne QU'UNE
        // personne. « Alexandre » seul en désigne deux — mieux vaut laisser
        // l'opérateur trancher que d'attribuer la vente au mauvais.
        const partiels = [...commByName.entries()].filter(([k]) => k && (k.includes(n) || n.includes(k)));
        if (partiels.length === 1) return partiels[0][1];

        for (const jeton of n.split(' ').filter((t) => t.length >= 4)) {
          const candidats = [...commByName.entries()].filter(([k]) => k.split(' ').includes(jeton));
          if (candidats.length === 1) return candidats[0][1];
        }
        return null;
      };

      const rows = ventes.map((v) => {
        const m = matchComm(v.commercial_nom);
        return {
          texte_source: v.texte_source || '',
          // Heure de la déclaration sur le groupe : c'est elle qui sera affichée.
          declare_le: horodatageDe(v, horodatages),
          quantite: Math.max(1, Math.min(20, Math.round(Number(v.quantite) || 1))),
          // Hors opération : la ligne remonte quand même, pour qu'on la voie,
          // mais décochée — à l'opérateur de la rattraper si l'IA se trompe.
          hors_operation: v.hors_operation === true,
          inclure: v.hors_operation !== true,
          commercial_id: m?.commercial_id || null,
          // Le nom n'est retenu QUE si le vendeur n'a pas de compte — sous son
          // nom d'annuaire s'il est reconnu, sous celui du message sinon.
          // Effacer ce dernier cas faisait rejeter la ligne comme incomplète :
          // un vendeur absent de la liste ne pouvait pas être déclaré du tout.
          commercial_nom: m?.commercial_id ? '' : (m?.nom || v.commercial_nom || ''),
          commercial_matched: m?.nom || null,
          client_nom: v.client_nom || '',
          // Rien n'est deviné : ce que le message ne dit pas reste VIDE, et
          // c'est l'opérateur qui tranche à l'écran. Un défaut silencieux —
          // « Tracteur », « Nouvelle commande » — se serait glissé dans les
          // comptages sans que personne ne puisse le rattraper.
          modele: (v.modele || '').trim(),
          type_machine: MACHINES.includes(v.type_machine) ? v.type_machine : '',
          // Défaut déduit du numéro de MAT, appliqué seulement si l'IA n'a rien
          // trouvé : la règle comble un trou, elle ne contredit pas le message.
          type_vente: TYPES_VENTE.includes(v.type_vente) ? v.type_vente
            : (aNumeroDeMat(v.texte_source, v.modele) ? 'Stock Gonnin-Duris' : ''),
          reprise: REPRISES.includes(v.reprise) ? v.reprise : '',
          marque_reprise: v.marque_reprise || '',
          date_vente: /^\d{4}-\d{2}-\d{2}$/.test(v.date_vente || '') ? v.date_vente
            : (horodatageDe(v, horodatages).slice(0, 10) || today),
          confiance: v.confiance || 'moyenne'
        };
      });

      return Response.json({ analyse: true, count: rows.length, ventes: rows });
    }

    // ---------- CREATION (À valider) ----------
    if (action === 'creer') {
      const sales = Array.isArray(body.sales) ? body.sales : [];
      if (sales.length === 0) return Response.json({ error: 'Aucune vente à créer' }, { status: 400 });

      // « Vendu 2 x T6.180 » : deux machines, donc deux ventes. Le suivi compte
      // des machines, pas des messages.
      const aCreer = [];
      let incompletes = 0;
      sales.forEach((v) => {
        const combien = Math.max(1, Math.min(20, Math.round(Number(v.quantite) || 1)));
        // Une ligne incomplète n'est pas créée avec des valeurs de secours :
        // elle est écartée et signalée, pour être complétée à l'écran.
        // Un vendeur sans compte est accepté par son NOM : il figure au tableau
        // de répartition sans s'être jamais connecté, et sa vente ne doit pas
        // être perdue pour autant.
        const vendeurNom = String(v.commercial_nom || '').trim();
        if (!MACHINES.includes(v.type_machine) || !TYPES_VENTE.includes(v.type_vente)
          || !REPRISES.includes(v.reprise) || (!v.commercial_id && !vendeurNom)) {
          incompletes += 1;
          return;
        }
        const ligne = {
          client_id: v.client_id || null,
          // Le nom annoncé est conservé même quand une fiche a été reconnue :
          // c'est sous ce nom-là que le vendeur retrouve sa déclaration.
          client_nom: String(v.client_nom || '').trim() || null,
          commercial_id: v.commercial_id || null,
          commercial_nom: v.commercial_id ? null : vendeurNom,
          date_vente: /^\d{4}-\d{2}-\d{2}$/.test(v.date_vente || '') ? v.date_vente
            : (String(v.declare_le || '').slice(0, 10) || today),
          modele: String(v.modele || '').trim() || null,
          type_machine: v.type_machine,
          type_vente: v.type_vente,
          reprise: v.reprise,
          marque_reprise: v.reprise === 'Reprise autre marque' ? (v.marque_reprise || null) : null,
          declare_le: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.declare_le || '') ? v.declare_le : null,
          source_declaration: 'Import WhatsApp',
          // Relue à l'écran d'analyse, la déclaration est acquise : un second
          // tour de validation ne vérifiait rien de plus et laissait les ventes
          // hors des compteurs tant que personne n'y repassait.
          statut_validation: 'Validé'
        };
        for (let i = 0; i < combien; i++) aCreer.push({ ...ligne });
      });

      let crees = 0;
      for (let i = 0; i < aCreer.length; i += 100) {
        const batch = aCreer.slice(i, i + 100);
        const res = await sr.entities.vente.bulkCreate(batch);
        crees += (res?.length || batch.length);
      }
      return Response.json({ ok: true, ventes_creees: crees, incompletes });
    }

    return Response.json({ error: 'action inconnue' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: `[importer_ventes_whatsapp] ${error?.message || String(error)}` }, { status: 500 });
  }
}