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
                texte_source: { type: 'string', description: 'Le message d\'origine, tel quel' },
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
- reprise : ${REPRISES.join(', ')}. LAISSE VIDE si le message ne dit rien de la reprise.
  « Sans reprise » ne se met QUE si le message l'indique explicitement. Si une marque
  concurrente est reprise, mets « Reprise autre marque » et renseigne marque_reprise.
- N'invente jamais une valeur pour combler un trou : un champ vide sera complété à la
  main, une valeur fausse passerait inaperçue.
- commercial_nom : le vendeur si identifiable (auteur du message ou nom cité).
- client_nom : l'exploitation/client si mentionné, sinon vide.
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
          quantite: Math.max(1, Math.min(20, Math.round(Number(v.quantite) || 1))),
          // Hors opération : la ligne remonte quand même, pour qu'on la voie,
          // mais décochée — à l'opérateur de la rattraper si l'IA se trompe.
          hors_operation: v.hors_operation === true,
          inclure: v.hors_operation !== true,
          commercial_nom: v.commercial_nom || '',
          commercial_id: m?.commercial_id || null,
          // Vendeur reconnu mais sans compte : on retient son nom.
          commercial_nom: m && !m.commercial_id ? m.nom : '',
          commercial_matched: m?.nom || null,
          client_nom: v.client_nom || '',
          // Rien n'est deviné : ce que le message ne dit pas reste VIDE, et
          // c'est l'opérateur qui tranche à l'écran. Un défaut silencieux —
          // « Tracteur », « Nouvelle commande » — se serait glissé dans les
          // comptages sans que personne ne puisse le rattraper.
          modele: (v.modele || '').trim(),
          type_machine: MACHINES.includes(v.type_machine) ? v.type_machine : '',
          type_vente: TYPES_VENTE.includes(v.type_vente) ? v.type_vente : '',
          reprise: REPRISES.includes(v.reprise) ? v.reprise : '',
          marque_reprise: v.marque_reprise || '',
          date_vente: /^\d{4}-\d{2}-\d{2}$/.test(v.date_vente || '') ? v.date_vente : today,
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
          commercial_id: v.commercial_id || null,
          commercial_nom: v.commercial_id ? null : vendeurNom,
          date_vente: /^\d{4}-\d{2}-\d{2}$/.test(v.date_vente || '') ? v.date_vente : today,
          modele: String(v.modele || '').trim() || null,
          type_machine: v.type_machine,
          type_vente: v.type_vente,
          reprise: v.reprise,
          marque_reprise: v.reprise === 'Reprise autre marque' ? (v.marque_reprise || null) : null,
          source_declaration: 'Import WhatsApp',
          statut_validation: 'À valider'
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