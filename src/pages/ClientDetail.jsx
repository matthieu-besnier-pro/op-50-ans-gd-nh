import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import StatutInline from '@/components/StatutInline';
import AppetenceGauge from '@/components/AppetenceGauge';
import RdvExpress from '@/components/RdvExpress';
import VenteDialog from '@/components/VenteDialog';
import ScriptAppel from '@/components/ScriptAppel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { canSeePac, getAppRole } from '@/lib/permissions';
import ParcMaterielTable from '@/components/ParcMaterielTable';
import { UsagesClient } from '@/components/MaterielPicto';
import CoachCommercial from '@/components/CoachCommercial';
import ClientRdvsEntete from '@/components/ClientRdvsEntete';
import ModifierClientDialog from '@/components/ModifierClientDialog';
import {
  ArrowLeft, Phone, MapPin, Calendar, Wrench, ShoppingBag,
  MessageSquare, Plus, Tractor, Mail, FileText, Star, Pencil
} from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, viewAsRole } = useAuth();
  const [client, setClient] = useState(null);
  const [materiels, setMateriels] = useState([]);
  const [commentaires, setCommentaires] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [venteOpen, setVenteOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [pulseRow, setPulseRow] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      let c = await base44.entities.client.get(id).catch(() => null);
      if (!c) {
        // Repli Direction/admin : via la fonction backend (asServiceRole) si le RLS bloque le get direct
        const res = await base44.functions.invoke('lister_clients', { client_id: id }).catch(() => null);
        c = (res?.data?.clients || [])[0] || null;
      }
      if (!c) { setLoading(false); return; }
      setClient(c);
      // Parc lu côté serveur (même canal que le reste de la fiche) : il s'affiche toujours.
      // Chaque section est isolée : l'échec d'un appel ne vide plus les autres.
      const [mats, coms, rds, vts] = await Promise.all([
        base44.functions.invoke('lister_clients', { materiel_client_id: id })
          .then((r) => r?.data?.materiels || [])
          .catch(() => []),
        base44.entities.commentaire.filter({ client_id: id }, '-created_date', 100).catch(() => []),
        base44.entities.rdv.filter({ client_id: id }, '-date_heure', 100).catch(() => []),
        base44.entities.vente.filter({ client_id: id }, '-date_vente', 100).catch(() => [])
      ]);
      setMateriels(mats);
      setCommentaires(coms);
      setRdvs(rds);
      setVentes(vts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const payload = {
      client_id: id,
      auteur_id: user.id,
      texte: newComment.trim()
    };
    if (client.commerciaux_assignes) payload.commerciaux_assignes = client.commerciaux_assignes;
    if (client.base_responsable_id) payload.base_responsable_id = client.base_responsable_id;
    await base44.entities.commentaire.create(payload);
    setNewComment('');
    loadAll();
  };

  if (loading) {
    return <Layout><Loader /></Layout>;
  }
  if (!client) {
    return <Layout><p className="text-center text-muted-foreground py-24">Client introuvable.</p></Layout>;
  }

  const showPac = canSeePac(user, viewAsRole);
  // Un chef d'atelier ne porte pas la fiche : son changement de statut passe par le
  // serveur, qui vérifie son périmètre (comme dans la partie SAV).
  const statutViaServeur = getAppRole(user, viewAsRole) === 'chef_atelier';

  return (
    <Layout>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* Header — il pulse brièvement quand un statut marquant est enregistré. */}
      <div className={`mb-6 rounded-xl border border-border bg-card p-5 shadow-sm ${pulseRow ? 'animate-pulse-gd' : ''}`}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gd-navy-dark flex items-center gap-2">
              {client.priorite_commercial && <Star className="h-5 w-5 shrink-0 text-gd-orange" fill="currentColor" aria-label="Cible prioritaire" />}
              {client.raison_sociale}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {client.priorite_commercial && (
                <span className="inline-flex items-center gap-1 rounded-full border border-gd-orange/30 bg-gd-orange/10 px-2.5 py-0.5 text-xs font-semibold text-gd-orange">
                  <Star className="h-3 w-3" fill="currentColor" /> Cible prioritaire
                </span>
              )}
              <AppetenceGauge niveau={client.niveau_appetence} score={client.score_appetence} className="min-w-[8.5rem]" />
              {client.type_structure && <span className="text-xs font-medium text-muted-foreground">{client.type_structure}</span>}
              {client.type_client_mistra && <span className="text-xs font-medium text-muted-foreground">· {client.type_client_mistra}</span>}
            </div>
            {Array.isArray(client.usages) && client.usages.length > 0 && (
              <UsagesClient usages={client.usages} className="mt-2" />
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 lg:items-end">
            <div className="flex gap-2">
              <Button onClick={() => setRdvOpen(true)} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
                <Calendar className="h-4 w-4 mr-1.5" /> Ajouter un RDV
              </Button>
              <Button onClick={() => setVenteOpen(true)} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
                <ShoppingBag className="h-4 w-4 mr-1.5" /> Déclarer une vente
              </Button>
              <Button onClick={() => setEditOpen(true)} variant="outline" className="border-border">
                <Pencil className="h-4 w-4 mr-1.5" /> Modifier
              </Button>
            </div>

            {/* Le statut, au même rang que les deux autres actions de la fiche. */}
            <div className="w-full rounded-lg border-2 border-gd-orange/40 bg-gd-orange/5 px-3 py-2 lg:w-auto">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Statut du client
              </p>
              <StatutInline
                client={client}
                user={user}
                align="end"
                viaServeur={statutViaServeur}
                onSaved={(maj) => {
                  setClient((c) => ({ ...c, ...maj }));
                  if (maj.statut === 'RDV Commercial obtenu' || maj.statut === 'Offre magasin à proposer') {
                    setPulseRow(true);
                    setTimeout(() => setPulseRow(false), 600);
                  }
                  loadAll();
                }}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Cliquez pour le changer</p>
            </div>
          </div>
        </div>

        {/* RDV du client */}
        <ClientRdvsEntete rdvs={rdvs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Coordonnées */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Coordonnées</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoLine icon={Phone} label="Tél. mobile" value={client.tel_mobile} />
              <InfoLine icon={Phone} label="Tél. fixe" value={client.tel_fixe} />
              <InfoLine icon={MapPin} label="Adresse" value={client.adresse_complete} />
              <InfoLine icon={MapPin} label="Code commune" value={client.code_commune} />
              <InfoLine icon={Mail} label="Email" value={client.email} />
              <InfoLine icon={Mail} label="Activité" value={client.activite_naf} />
              <InfoLine icon={Mail} label="SIREN" value={client.siren} />
            </div>
          </div>

          {/* Matériel */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Tractor className="h-4 w-4 text-gd-orange" /> Parc cible ({materiels.length})
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">Matériel éligible à l'opération 50 ans Gonnin Duris × New Holland.</p>
            <ParcMaterielTable materiels={materiels} />
          </div>

          {/* Commentaires */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="h-4 w-4 text-gd-orange" /> Commentaires
            </h2>
            <div className="mb-4 flex gap-2">
              <Textarea rows={2} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Ajouter un commentaire…" />
              <Button onClick={handleAddComment} size="icon" className="bg-gd-navy hover:bg-gd-navy-dark text-white shrink-0"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">
              {commentaires.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Aucun commentaire.</p>
              ) : commentaires.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{c.texte}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(c.created_date).toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Coach Commercial */}
          <CoachCommercial client={client} materiels={materiels} rdvs={rdvs} ventes={ventes} />

          {/* Ventes */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <ShoppingBag className="h-4 w-4 text-gd-orange" /> Ventes
            </h2>
            <div className="space-y-2">
              {ventes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Aucune vente.</p>
              ) : ventes.map((v) => (
                <div key={v.id} className="rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{v.type_machine}</p>
                    <StatusBadge statut={v.statut_validation} />
                  </div>
                  <p className="text-xs text-muted-foreground">{v.date_vente} · {v.type_vente}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PAC - direction only */}
          {showPac && (
            <div className="rounded-xl border border-gd-orange/30 bg-gd-orange/5 p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gd-navy">Données PAC (Direction)</h2>
              <div className="space-y-2 text-sm">
                <p>Montant PAC : <span className="font-bold text-gd-navy">{client.montant_pac != null ? client.montant_pac.toLocaleString('fr-FR') + ' €' : '—'}</span></p>
                <p>Usage autorisé : <span className="font-semibold">{client.usage_pac_autorise ? 'Oui' : 'Non'}</span></p>
                <p>Bénéficiaire certain : <span className="font-semibold">{client.beneficiaire_pac_certain ? 'Oui' : 'Non'}</span></p>
              </div>
            </div>
          )}

          <ScriptAppel />
        </div>
      </div>

      <RdvExpress open={rdvOpen} onOpenChange={setRdvOpen} client={client} commercialId={user.id} onSaved={loadAll} />
      <VenteDialog open={venteOpen} onOpenChange={setVenteOpen} client={client} commercialId={user.id} onSaved={loadAll} />
      <ModifierClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} onSaved={loadAll} />
    </Layout>
  );
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value || '—'}</p>
      </div>
    </div>
  );
}