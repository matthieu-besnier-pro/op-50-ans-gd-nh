import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import StatusBadge from '@/components/StatusBadge';
import AppetenceBadge from '@/components/AppetenceBadge';
import RdvExpress from '@/components/RdvExpress';
import VenteDialog from '@/components/VenteDialog';
import ScriptAppel from '@/components/ScriptAppel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { canSeePac } from '@/lib/permissions';
import ParcMaterielTable from '@/components/ParcMaterielTable';
import CoachCommercial from '@/components/CoachCommercial';
import {
  ArrowLeft, Phone, MapPin, Calendar, Wrench, ShoppingBag,
  MessageSquare, Plus, Tractor, Mail, Euro, FileText
} from 'lucide-react';

const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite', 'RDV obtenu', 'Prise de RDV atelier', 'Devis en cours', 'Offre magasin à proposer', 'Vente conclue', 'Refus'];
const MOTIFS_REFUS = ['Pas de besoin', 'Concurrent', 'Budget', 'Autre'];

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
  const [statutEdit, setStatutEdit] = useState('');
  const [dateRappel, setDateRappel] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [montantDevis, setMontantDevis] = useState('');
  const [statutError, setStatutError] = useState('');
  const [pulseRow, setPulseRow] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      let c = await base44.entities.client.get(id).catch(() => null);
      if (!c) {
        // Repli Direction/admin : via la fonction backend (asServiceRole) si le RLS bloque le get direct
        const res = await base44.functions.invoke('lister_clients', {}).catch(() => null);
        c = (res?.data?.clients || []).find((x) => x.id === id) || null;
      }
      if (!c) { setLoading(false); return; }
      setClient(c);
      setStatutEdit(c.statut || 'À contacter');
      const [mats, coms, rds, vts] = await Promise.all([
        base44.entities.materiel.filter({ client_id: id }, '-created_date', 500),
        base44.entities.commentaire.filter({ client_id: id }, '-created_date', 100),
        base44.entities.rdv.filter({ client_id: id }, '-date_heure', 100),
        base44.entities.vente.filter({ client_id: id }, '-date_vente', 100)
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

  const handleStatutChange = async () => {
    setStatutError('');
    if (statutEdit === 'À rappeler' && !dateRappel) {
      setStatutError('La date de rappel est obligatoire pour le statut « À rappeler ».');
      return;
    }
    if (statutEdit === 'Refus' && !motifRefus) {
      setStatutError('Le motif de refus est obligatoire.');
      return;
    }
    const updates = {
      statut: statutEdit,
      date_dernier_contact: new Date().toISOString().slice(0, 10)
    };
    if (statutEdit === 'Injoignable') {
      updates.nb_tentatives_contact = (client.nb_tentatives_contact || 0) + 1;
    }
    if (statutEdit === 'À rappeler') updates.date_rappel = dateRappel;
    if (statutEdit === 'Refus') updates.motif_refus = motifRefus;
    if (statutEdit === 'Devis en cours' && montantDevis) updates.montant_devis = Number(montantDevis);

    await base44.entities.client.update(id, updates);
    if (statutEdit === 'RDV obtenu' || statutEdit === 'Offre magasin à proposer') {
      setPulseRow(true);
      setTimeout(() => setPulseRow(false), 600);
    }
    // Badges : toujours pour le commercial affecté au client (la fiche fait foi)
    const assignes = client.commerciaux_assignes || [];
    const badgeUserId = assignes.includes(user.id) ? user.id : (assignes[0] || user.id);
    try { await base44.functions.invoke('verifier_badges', { utilisateur_id: badgeUserId }); } catch (e) { /* ignore */ }
    loadAll();
    setDateRappel(''); setMotifRefus(''); setMontantDevis('');
  };

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

  return (
    <Layout>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* Header */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gd-navy-dark">{client.raison_sociale}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge statut={client.statut} />
              <AppetenceBadge niveau={client.niveau_appetence} score={client.score_appetence} />
              {client.type_structure && <span className="text-xs font-medium text-muted-foreground">{client.type_structure}</span>}
              {client.type_client_mistra && <span className="text-xs font-medium text-muted-foreground">· {client.type_client_mistra}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setRdvOpen(true)} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
              <Calendar className="h-4 w-4 mr-1.5" /> Ajouter un RDV
            </Button>
            <Button onClick={() => setVenteOpen(true)} variant="outline" className="border-gd-navy text-gd-navy hover:bg-gd-navy hover:text-white">
              <ShoppingBag className="h-4 w-4 mr-1.5" /> Déclarer une vente
            </Button>
          </div>
        </div>
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
              <InfoLine icon={Mail} label="Activité" value={client.activite_naf} />
              <InfoLine icon={Mail} label="SIREN" value={client.siren} />
            </div>
          </div>

          {/* Matériel */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Tractor className="h-4 w-4 text-gd-orange" /> Parc matériel ({materiels.length})
            </h2>
            <ParcMaterielTable materiels={materiels} />
          </div>

          {/* Données commerciales */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Euro className="h-4 w-4 text-gd-orange" /> Données commerciales
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              <DataLine label="CA total 12 mois" value={client.ca_total_12m != null ? client.ca_total_12m.toLocaleString('fr-FR') + ' €' : null} />
              <DataLine label="CA pièces 12 mois" value={client.ca_pieces_12m != null ? client.ca_pieces_12m.toLocaleString('fr-FR') + ' €' : null} />
              <DataLine label="CA SAV 12 mois" value={client.ca_sav_12m != null ? client.ca_sav_12m.toLocaleString('fr-FR') + ' €' : null} />
              <DataLine label="Panier moyen" value={client.panier_moyen != null ? client.panier_moyen.toLocaleString('fr-FR') + ' €' : null} />
              <DataLine label="Nb factures" value={client.nb_factures} />
              <DataLine label="Segment RFM" value={client.segment_rfm} />
              <DataLine label="Dernière facture" value={client.date_derniere_facture} />
              <DataLine label="OT ouverts" value={client.nb_ot_ouverts} />
            </div>
          </div>

          {/* Statut change */}
          <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${pulseRow ? 'animate-pulse-gd' : ''}`}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Changer le statut</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statutEdit} onValueChange={setStatutEdit}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleStatutChange} className="bg-gd-navy hover:bg-gd-navy-dark text-white">Mettre à jour</Button>
            </div>
            {statutEdit === 'À rappeler' && (
              <div className="mt-3"><Label className="text-xs">Date de rappel (obligatoire)</Label><Input type="date" value={dateRappel} onChange={(e) => setDateRappel(e.target.value)} className="mt-1" /></div>
            )}
            {statutEdit === 'Refus' && (
              <div className="mt-3">
                <Label className="text-xs">Motif de refus (obligatoire)</Label>
                <Select value={motifRefus} onValueChange={setMotifRefus}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>{MOTIFS_REFUS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {statutEdit === 'Devis en cours' && (
              <div className="mt-3"><Label className="text-xs">Montant du devis (€)</Label><Input type="number" value={montantDevis} onChange={(e) => setMontantDevis(e.target.value)} className="mt-1" placeholder="Ex. 45000" /></div>
            )}
            {statutError && <p className="mt-2 text-sm text-destructive">{statutError}</p>}
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

          {/* RDV */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-4 w-4 text-gd-orange" /> Rendez-vous
            </h2>
            <div className="space-y-2">
              {rdvs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Aucun RDV.</p>
              ) : rdvs.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{new Date(r.date_heure).toLocaleDateString('fr-FR')}</p>
                    <StatusBadge statut={r.statut} />
                  </div>
                  <p className="text-xs text-muted-foreground">{r.type} · {r.duree_minutes || 30} min</p>
                </div>
              ))}
            </div>
          </div>

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

function DataLine({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value || '—'}</p>
    </div>
  );
}