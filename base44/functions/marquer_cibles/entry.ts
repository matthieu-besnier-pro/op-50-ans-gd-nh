import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Marque des clients DÉJÀ EN BASE comme cibles prioritaires d'un commercial
// (les lignes surlignées en jaune dans son fichier). Sert aux commerciaux qui
// rendent leur fichier après l'import initial.
//
// body = {
//   sirens: ['123456789', …],        // identifiants (tolère SIRET : 9 premiers chiffres)
//   noms:   ['GAEC MACHIN', …],      // repli par raison sociale, pour les lignes sans SIREN
//   secteur: 'Alexandre BELLIN',     // facultatif : limite la portée et permet la remise à zéro
//   reinitialiser: true              // repart de zéro sur ce secteur avant de marquer
// }

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const sirenClean = (v) => {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length >= 9 ? d.slice(0, 9) : null;
};

async function listerTout(sr) {
  const out = [];
  for (let i = 0; i < 20; i++) {
    const page = await sr.entities.client.list('-created_date', 1000, i * 1000);
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sirens = new Set((body.sirens || []).map(sirenClean).filter(Boolean));
    const noms = new Set((body.noms || []).map(norm).filter(Boolean));
    const secteur = body.secteur ? norm(body.secteur) : null;
    if (sirens.size === 0 && noms.size === 0) {
      return Response.json({ error: 'Aucun SIREN ni nom fourni.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const clients = await listerTout(sr);

    // Remise à zéro du secteur : les cibles précédentes de ce commercial sont effacées,
    // pour que relancer l'opération ne cumule pas d'anciens choix.
    let remisAZero = 0;
    if (body.reinitialiser && secteur) {
      for (const c of clients) {
        if (c.priorite_commercial && norm(c.secteur) === secteur) {
          await sr.entities.client.update(c.id, { priorite_commercial: false }).catch(() => {});
          remisAZero++;
        }
      }
    }

    const vus = new Set();
    let marques = 0;
    for (const c of clients) {
      // Si un secteur est précisé, on ne touche qu'à ses clients (évite d'empiéter
      // sur le ciblage d'un collègue en cas de SIREN partagé).
      if (secteur && norm(c.secteur) !== secteur) continue;
      const s = sirenClean(c.siren);
      const parSiren = s && sirens.has(s);
      const parNom = noms.size > 0 && noms.has(norm(c.raison_sociale));
      if (!parSiren && !parNom) continue;
      if (parSiren) vus.add(s);
      if (parNom) vus.add(norm(c.raison_sociale));
      if (!c.priorite_commercial) {
        await sr.entities.client.update(c.id, { priorite_commercial: true }).catch(() => {});
      }
      marques++;
    }

    const introuvables = [
      ...[...sirens].filter((s) => !vus.has(s)),
      ...[...noms].filter((n) => !vus.has(n))
    ];

    return Response.json({
      ok: true,
      demandes: sirens.size + noms.size,
      marques,
      remis_a_zero: remisAZero,
      introuvables
    });
  } catch (error) {
    return Response.json({ error: `[marquer_cibles] ${error?.message || String(error)}` }, { status: 500 });
  }
}
