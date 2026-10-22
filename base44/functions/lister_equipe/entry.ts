import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { equipeManagee, perimetreAtelier, sitesAtelierDe, sujetDeLaRequete } from '../../shared/perimetre.ts';
import { cleSite, cleNom, comptesDesChefs, basesCompletees } from '../../shared/atelier.ts';

// Effectif des chefs d'atelier d'une liste de sites. TOUS y figurent, qu'ils
// aient déjà un compte ou non : l'équipe doit être complète, comme l'est la
// liste des commerciaux côté commerce, qui vient du fichier d'import. Un chef
// sans compte apparaît simplement sans activité — et son absence se voit, au
// lieu de passer inaperçue.
function effectifChefs(mesBases, comptes) {
  const parCle = new Map();
  for (const b of mesBases) {
    for (const nom of (b.chefs_atelier || [])) {
      if (!nom) continue;
      const cle = cleNom(nom);
      const deja = parCle.get(cle);
      // Un même chef peut couvrir plusieurs sites : une seule ligne, tous ses sites.
      if (deja) {
        if (b.nom && !deja.sites.includes(b.nom)) deja.sites.push(b.nom);
        continue;
      }
      const { ids } = comptesDesChefs([nom], comptes);
      const compte = ids.length === 1 ? comptes.find((u) => u.id === ids[0]) : null;
      parCle.set(cle, {
        id: compte?.id || `chef:${cle}`,
        user_id: compte?.id || null,
        // Le nom du tableau de répartition prime : les comptes ont souvent pour
        // nom complet l'identifiant de leur adresse (« amandine-chauveau »),
        // illisible dans un tableau d'équipe.
        full_name: nom || compte?.full_name || '',
        email: compte?.email || '',
        sites: b.nom ? [b.nom] : []
      });
    }
  }
  return [...parCle.values()];
}

// Renvoie les membres de l'équipe du responsable connecté (ou toute l'équipe pour la Direction).
// Les non-admins ne peuvent pas lister les utilisateurs via le SDK client — d'où cette fonction en service role.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const appelant = await base44.auth.me();
    if (!appelant) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    // « Voir en tant que » : la réponse est calculée pour le compte visé, pas
    // pour l'appelant. Tout ce qui suit raisonne donc sur `user` — c'est-à-dire
    // la personne qu'on regarde — et la page n'a rien à refiltrer.
    const user = await sujetDeLaRequete(sr, appelant, body);
    const appRole = user.app_role || 'collaborateur';
    const isAdmin = user.role === 'admin' || appRole === 'direction';

    // Le responsable SAV encadre lui aussi une équipe : ses chefs d'atelier.
    const estResponsableSav = appRole === 'responsable_sav';
    if (!isAdmin && appRole !== 'responsable' && !estResponsableSav) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 });
    }

    let teamBaseIds = [];
    let teamMembers = [];
    // Noms des vendeurs de l'équipe : la page s'en sert pour ne garder que les
    // fiches concernées. null = aucune restriction (Direction).
    let fiches = null;

    // « Voir en tant que » un référent d'atelier : la Direction demande l'équipe
    // de sites précis. Sans cela la page retombait sur le compte réellement
    // connecté — et affichait une équipe vide.
    const sitesDemandes = Array.isArray(body?.sites) ? body.sites.filter(Boolean) : [];

    // « Voir en tant que » : la Direction demande l'équipe d'une personne
    // nommée, pas la sienne. Sans ce sujet explicite, la page retomberait sur
    // le compte réellement connecté — celui de la Direction, qui voit tout.
    const nomVise = typeof body?.manager === 'string' ? body.manager.trim() : '';
    // Le sujet doit être le COMPTE visé, pas seulement son nom : sa seconde
    // casquette ne se lit que sur son enregistrement.
    let sujet = user;
    if (isAdmin && nomVise) {
      const tous = await sr.entities.User.list('-created_date', 500).catch(() => []);
      const vise = cleNom(nomVise);
      sujet = (tous || []).find((u) => cleNom(u.full_name || '') === vise
        || cleNom(String(u.email || '').split('@')[0].replace(/[._-]+/g, ' ')) === vise)
        || { full_name: nomVise, email: '' };
    }

    // La seconde équipe d'un double rôle, quel que soit le rôle PRINCIPAL :
    // encadrer deux équipes n'est pas le privilège du responsable SAV.
    //
    // Sa composition dépend de la seconde fonction, car toutes ne se
    // constituent pas de la même façon :
    //   — l'agriculture de précision est une FONCTION : ses spécialistes se
    //     reconnaissent à leur rôle, aucune fiche ne nomme qui les encadre ;
    //   — l'atelier se lit dans le tableau de répartition, site par site ;
    //   — une équipe de vendeurs se lit dans la structure commerciale.
    const demandeSeconde = body?.sav === false;
    const roleSujet = sujet?.app_role || '';
    const estAtelier = (r) => r === 'responsable_sav' || r === 'chef_atelier' || r === 'commercial_chef_atelier';

    // Nature de la seconde équipe.
    //
    // Elle est DÉDUITE avant d'être lue sur le compte : quelqu'un nommé dans le
    // tableau de répartition répond d'un atelier, que son compte le dise ou
    // non. C'est le cas de qui est enregistré « responsable commercial » tout
    // en dirigeant le SAV — et il n'y a rien à ressaisir pour que ça marche.
    //
    // Le second rôle renseigné à la main reste prioritaire, et sert aux
    // fonctions qu'aucun fichier ne désigne, l'agriculture de précision en tête.
    const atelierDuSujet = estAtelier(roleSujet) ? { bases: [] } : await sitesAtelierDe(sr, sujet);
    const secondRole = sujet?.app_role_secondaire
      || ((atelierDuSujet.bases || []).length > 0 ? 'responsable_sav' : '');

    const equipeSeconde = async () => {
      if (!secondRole) return { membres: [], noms: [] };
      const tous = await sr.entities.User.list('-created_date', 500).catch(() => []);

      if (estAtelier(secondRole)) {
        // Les sites déjà trouvés, sinon ceux que son rôle lui donne.
        let mesBases = atelierDuSujet.bases || [];
        if (mesBases.length === 0) {
          const perimetre = await perimetreAtelier(sr, sujet);
          const toutesBases = basesCompletees(await sr.entities.base.list('nom', 500).catch(() => []));
          const vises = new Set((perimetre?.sites || []).map(cleSite));
          mesBases = toutesBases.filter((b) => vises.has(cleSite(b.nom)));
        }
        return { membres: effectifChefs(mesBases, tous), noms: [] };
      }

      if (secondRole === 'responsable') {
        const e = await equipeManagee(sr, sujet);
        const ids = new Set(e?.ids || []);
        return { membres: tous.filter((u) => ids.has(u.id)), noms: e?.noms || [] };
      }

      return { membres: tous.filter((u) => u.app_role === secondRole && u.id !== sujet?.id), noms: [] };
    };

    // Catalogue des équipes d'une personne. Il y en a parfois plus de deux —
    // un responsable commercial qui dirige aussi le SAV et l'agriculture de
    // précision en a trois — et une bascule à deux onglets en escamotait une.
    const LIBELLES = {
      commercial: 'Équipe commerce',
      agri_precision: 'Équipe GPS',
      responsable: 'Équipe commerce',
      chef_atelier: 'Équipe atelier',
      commercial_chef_atelier: 'Équipe atelier',
      responsable_sav: 'Équipe SAV'
    };
    const catalogue = [];
    if (!isAdmin) {
      catalogue.push({ cle: 'principale', role: roleSujet, libelle: LIBELLES[roleSujet] || 'Mon équipe' });
      // Nommé dans le tableau de répartition sans porter le rôle : son atelier
      // existe quand même, et c'est la seule trace qu'on en ait.
      if (!estAtelier(roleSujet) && (atelierDuSujet.bases || []).length > 0) {
        catalogue.push({ cle: 'atelier', role: 'responsable_sav', libelle: 'Équipe SAV' });
      }
      const saisi = sujet?.app_role_secondaire || '';
      if (saisi && saisi !== roleSujet && !catalogue.some((e) => e.role === saisi)) {
        catalogue.push({ cle: saisi, role: saisi, libelle: LIBELLES[saisi] || 'Seconde équipe' });
      }
    }

    const tousLesComptes = async () => sr.entities.User.list('-created_date', 500).catch(() => []);
    const construire = async (entree) => {
      if (entree.cle === 'atelier') {
        return { membres: effectifChefs(atelierDuSujet.bases || [], await tousLesComptes()), noms: [] };
      }
      if (entree.cle !== 'principale') {
        if (entree.role === 'responsable') {
          const e = await equipeManagee(sr, sujet);
          const ids = new Set(e?.ids || []);
          return { membres: (await tousLesComptes()).filter((u) => ids.has(u.id)), noms: e?.noms || [] };
        }
        return {
          membres: (await tousLesComptes()).filter((u) => u.app_role === entree.role && u.id !== sujet?.id),
          noms: []
        };
      }
      // Équipe du rôle principal.
      if (estAtelier(roleSujet)) {
        const perimetre = await perimetreAtelier(sr, sujet);
        const toutes = basesCompletees(await sr.entities.base.list('nom', 500).catch(() => []));
        const vises = new Set((perimetre?.sites || []).map(cleSite));
        return { membres: effectifChefs(toutes.filter((b) => vises.has(cleSite(b.nom))), await tousLesComptes()), noms: [] };
      }
      const e = await equipeManagee(sr, sujet);
      const ids = new Set(e?.ids || []);
      return { membres: (await tousLesComptes()).filter((u) => ids.has(u.id)), noms: e?.noms || [] };
    };

    // Quelle équipe est demandée. `sav=0` désigne la seconde, par compatibilité
    // avec le lien déjà en circulation.
    const cleDemandee = typeof body?.equipe === 'string' && body.equipe
      ? body.equipe
      : (demandeSeconde ? (catalogue[1]?.cle || '') : '');

    // La Direction veut voir l'équipe SAV complète, sans se mettre à la place de
    // personne : tous les chefs d'atelier, de tous les ateliers.
    if (catalogue.length > 0) {
      const choisie = catalogue.find((e) => e.cle === cleDemandee) || catalogue[0];
      const r = await construire(choisie);
      teamMembers = r.membres;
      fiches = r.noms;
    } else if (demandeSeconde && (secondRole || (isAdmin && nomVise))) {
      // La SECONDE équipe, demandée explicitement. Elle passe avant tout le
      // reste : le rôle principal ne doit pas la court-circuiter, c'est
      // précisément ce qui la rendait inatteignable.
      const seconde = await equipeSeconde();
      teamMembers = seconde.membres;
      fiches = seconde.noms;
      // Les vendeurs dont le sujet est manager s'y ajoutent, s'il y en a.
      const managee = await equipeManagee(sr, sujet);
      if ((managee?.noms || []).length > 0) {
        fiches = [...new Set([...(fiches || []), ...managee.noms])];
        const ids = new Set(managee.ids || []);
        const tous = await sr.entities.User.list('-created_date', 500).catch(() => []);
        tous.filter((u) => ids.has(u.id)).forEach((u) => {
          if (!teamMembers.some((m) => m.id === u.id)) teamMembers.push(u);
        });
      }
    } else if (isAdmin && body?.sav === true && sitesDemandes.length === 0) {
      const bases = basesCompletees(await sr.entities.base.list('nom', 500).catch(() => []));
      const allUsers = await sr.entities.User.list('-created_date', 500);
      teamMembers = effectifChefs(bases, allUsers);
      teamBaseIds = bases.map((b) => b.id).filter(Boolean);
      fiches = [];
    } else if (isAdmin && sitesDemandes.length > 0) {
      const bases = basesCompletees(await sr.entities.base.list('nom', 500).catch(() => []));
      const vises = new Set(sitesDemandes.map(cleSite));
      const mesBases = (bases || []).filter((b) => vises.has(cleSite(b.nom)));
      const allUsers = await sr.entities.User.list('-created_date', 500);
      teamMembers = effectifChefs(mesBases, allUsers);
      teamBaseIds = mesBases.map((b) => b.id).filter(Boolean);
      fiches = [];
    } else if (isAdmin) {
      const allBases = await sr.entities.base.list('-nom', 100);
      teamBaseIds = allBases.map((b) => b.id);
      const allUsers = await sr.entities.User.list('-created_date', 200);
      teamMembers = allUsers.filter((u) => u.app_role === 'commercial');
      // Un responsable SAV qui encadre aussi une équipe commerciale —
      // l'agriculture de précision, par exemple — demande explicitement l'une
      // ou l'autre. Sans ce choix, son rôle le renverrait toujours au SAV et
      // la seconde équipe resterait hors d'atteinte.
    } else if (estResponsableSav && body?.sav !== false) {
      // Les chefs d'atelier ne figurent pas dans la structure commerciale : ils
      // sont nommés site par site dans le tableau de répartition. L'équipe d'un
      // responsable SAV, ce sont donc les chefs des sites dont il répond.
      const perimetre = await perimetreAtelier(sr, user);
      const bases = basesCompletees(await sr.entities.base.list('nom', 500).catch(() => []));
      const mesSites = new Set((perimetre?.sites || []).map(cleSite));
      const mesBases = (bases || []).filter((b) => mesSites.has(cleSite(b.nom)));
      const allUsers = await sr.entities.User.list('-created_date', 500);
      teamMembers = effectifChefs(mesBases, allUsers);
      teamBaseIds = mesBases.map((b) => b.id).filter(Boolean);
      // Aucune fiche commerciale à conserver : l'équipe est entièrement composée
      // de comptes sans secteur.
      fiches = [];
    } else {
      // L'équipe d'un responsable vient de la structure commerciale (il en est le
      // manager), et non du rattachement à un site — jamais renseigné.
      const equipe = await equipeManagee(sr, user);
      fiches = equipe?.noms || [];
      const ids = new Set(equipe?.ids || []);
      const allUsers = await sr.entities.User.list('-created_date', 200);
      teamMembers = allUsers.filter((u) => ids.has(u.id));
    }

    // Nombre de vendeurs encadrés par ailleurs : il décide de l'affichage de
    // la bascule entre les deux équipes, qui ne doit apparaître que pour qui
    // en a vraiment deux.
    // Le sujet vaut la personne visionnée quand il y en a une, le compte
    // connecté sinon : la bascule doit parler de l'équipe qu'on regarde.
    // Taille de la seconde équipe : elle décide de l'affichage de la bascule,
    // qui n'a lieu d'être que pour qui en a vraiment deux.
    // Les équipes offertes, avec leur effectif : la page n'affiche d'onglets
    // que s'il y en a plusieurs, et n'en propose aucun de vide.
    const equipes = [];
    for (const e of catalogue) {
      const taille = e.cle === (catalogue.find((c) => c.cle === cleDemandee) || catalogue[0])?.cle
        ? teamMembers.length
        : (await construire(e)).membres.length;
      if (taille > 0 || e.cle === 'principale') equipes.push({ cle: e.cle, libelle: e.libelle, taille, role_affiche: e.role });
    }

    return Response.json({
      fiches,
      commerce: equipes.length > 1 ? equipes[1].taille : 0,
      // Nommer la seconde équipe plutôt que de l'appeler « commerce » : un
      // responsable SAV qui encadre le GPS n'encadre pas des vendeurs.
      second_role: secondRole,
      equipes,
      // Ce que le serveur a RÉELLEMENT trouvé pour ce compte. Affiché à la
      // Direction : sans cela, un rattachement manquant dans les fichiers et
      // un défaut de code se ressemblent, et on cherche du mauvais côté.
      diagnostic: {
        compte: sujet?.full_name || sujet?.email || '',
        role: sujet?.app_role || '',
        second_role_saisi: sujet?.app_role_secondaire || '',
        sites_atelier: (atelierDuSujet.bases || []).map((b) => b.nom).filter(Boolean),
        vendeurs_manages: ((await equipeManagee(sr, sujet))?.noms || []).length
      },
      equipe_active: (catalogue.find((e) => e.cle === cleDemandee) || catalogue[0])?.cle || '',
      // Rôle du compte regardé : la page s'en sert pour choisir son écran,
      // et il n'est plus devinable côté navigateur depuis que la simulation
      // se résout ici.
      role_principal: user?.app_role || '',
      // `sites` n'existe que pour les chefs d'atelier ; la page s'en sert pour
      // afficher à quel atelier chacun est rattaché.
      members: teamMembers.map((m) => ({
        id: m.id,
        full_name: m.full_name,
        email: m.email,
        base_id: m.base_id,
        user_id: m.user_id ?? m.id,
        sites: m.sites || null
      })),
      base_ids: teamBaseIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}