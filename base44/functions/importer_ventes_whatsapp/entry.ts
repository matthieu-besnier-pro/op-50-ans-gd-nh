import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Import des ventes déclarées sur le groupe WhatsApp — le commercial ne ressaisit rien.
// action = 'analyser' : extrait les ventes du texte collé (IA), rapproche le commercial par son nom.
// action = 'creer'    : crée les ventes revues, en statut « À valider ».

const MACHINES = ['Tracteur', 'Moissonneuse', 'Big Baler', 'Round Baler', 'Télescopique', 'Ensileuse', 'Machine à vendanger'];
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
                type_machine: { type: 'string', enum: MACHINES },
                type_vente: { type: 'string', enum: TYPES_VENTE },
                reprise: { type: 'string', enum: REPRISES },
                marque_reprise: { type: 'string', description: 'Marque reprise si reprise autre marque' },
                date_vente: { type: 'string', description: 'Date au format AAAA-MM-JJ si mentionnée, sinon vide' },
                confiance: { type: 'string', enum: ['haute', 'moyenne', 'basse'] }
              }
            }
          }
        }
      };

      const prompt = `Tu analyses des messages d'un groupe WhatsApp de commerciaux agricoles (concession New Holland) qui déclarent leurs ventes de matériel en texte libre.
Extrais UNIQUEMENT les messages qui déclarent une vente réelle de machine (ignore les félicitations, blagues, questions, messages sans vente).
Pour chaque vente :
- type_machine : rattache au plus proche parmi ${MACHINES.join(', ')}.
- type_vente : ${TYPES_VENTE.join(', ')} (par défaut « Nouvelle commande » si non précisé).
- reprise : ${REPRISES.join(', ')} (par défaut « Sans reprise »). Si une marque concurrente est reprise, mets « Reprise autre marque » et renseigne marque_reprise.
- commercial_nom : le vendeur si identifiable (auteur du message ou nom cité).
- client_nom : l'exploitation/client si mentionné, sinon vide.
- confiance : ton niveau de certitude sur l'extraction.
Exemple de message : « T5.100 EC n°97507 avec chargeur Q4L n°98145 Reprise Valtra 6250 de 2000 » → Tracteur, Nouvelle commande, Reprise autre marque, marque_reprise Valtra.

Messages à analyser :
"""${rawText.slice(0, 12000)}"""`;

      let llm;
      try {
        llm = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
      } catch (e) {
        return Response.json({ error: `Analyse IA indisponible : ${e?.message || e}` }, { status: 500 });
      }
      const ventes = (llm?.ventes || llm?.data?.ventes || []);

      // Rapprochement commercial par nom (users + structure_commerciale)
      const [users, structure] = await Promise.all([
        sr.entities.User.list('-created_date', 300).catch(() => []),
        sr.entities.structure_commerciale.list('-nom_commercial', 300).catch(() => [])
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
      const matchComm = (nom) => {
        if (!nom) return null;
        const n = norm(nom);
        if (commByName.has(n)) return commByName.get(n);
        for (const [k, v] of commByName) {
          if (k && (k.includes(n) || n.includes(k))) return v;
        }
        return null;
      };

      const rows = ventes.map((v) => {
        const m = matchComm(v.commercial_nom);
        return {
          texte_source: v.texte_source || '',
          commercial_nom: v.commercial_nom || '',
          commercial_id: m?.commercial_id || null,
          commercial_matched: m?.nom || null,
          client_nom: v.client_nom || '',
          type_machine: MACHINES.includes(v.type_machine) ? v.type_machine : 'Tracteur',
          type_vente: TYPES_VENTE.includes(v.type_vente) ? v.type_vente : 'Nouvelle commande',
          reprise: REPRISES.includes(v.reprise) ? v.reprise : 'Sans reprise',
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

      const aCreer = sales.map((v) => ({
        client_id: v.client_id || null,
        commercial_id: v.commercial_id || null,
        date_vente: /^\d{4}-\d{2}-\d{2}$/.test(v.date_vente || '') ? v.date_vente : today,
        type_machine: MACHINES.includes(v.type_machine) ? v.type_machine : 'Tracteur',
        type_vente: TYPES_VENTE.includes(v.type_vente) ? v.type_vente : 'Nouvelle commande',
        reprise: REPRISES.includes(v.reprise) ? v.reprise : 'Sans reprise',
        marque_reprise: v.reprise === 'Reprise autre marque' ? (v.marque_reprise || null) : null,
        source_declaration: 'Import WhatsApp',
        statut_validation: 'À valider'
      }));

      let crees = 0;
      for (let i = 0; i < aCreer.length; i += 100) {
        const batch = aCreer.slice(i, i + 100);
        const res = await sr.entities.vente.bulkCreate(batch);
        crees += (res?.length || batch.length);
      }
      return Response.json({ ok: true, ventes_creees: crees });
    }

    return Response.json({ error: 'action inconnue' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: `[importer_ventes_whatsapp] ${error?.message || String(error)}` }, { status: 500 });
  }
}
