import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Briefcase, Users, Calendar, LayoutDashboard,
  Store, Settings, LogOut, Menu, X, Eye, Monitor, Bot, UserCircle, Rocket, Megaphone, Presentation,
  ChevronLeft, ChevronRight, ClipboardCheck
} from 'lucide-react';
import { getAppRole, isDirection, accueilRole } from '@/lib/permissions';
import { listerPartage, invalider } from '@/lib/donneesPartagees';
import OpLogo from '@/components/OpLogo';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const ROLE_LABELS = {
  commercial: 'Commercial',
  agri_precision: 'Agriculture de précision',
  responsable: 'Responsable commercial',
  chef_atelier: "Chef d'atelier",
  commercial_chef_atelier: "Chef d'atelier + Commercial",
  responsable_sav: 'Responsable SAV',
  direction: 'Direction / Marketing',
  collaborateur: 'Collaborateur'
};

const SECTION_LABELS = {
  pilotage: 'Pilotage',
  activite: 'Activité commerciale',
  atelier: 'Atelier',
  admin: 'Administration'
};

const navItems = [
  { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['commercial', 'agri_precision', 'commercial_chef_atelier', 'responsable', 'chef_atelier', 'responsable_sav', 'direction', 'collaborateur'], section: 'pilotage' },
  { to: '/calendrier', label: 'Calendrier', icon: Calendar, roles: ['commercial', 'agri_precision', 'commercial_chef_atelier', 'responsable', 'chef_atelier', 'responsable_sav', 'direction'], section: 'pilotage' },
  { to: '/grand-ecran', label: 'Grand Écran', icon: Monitor, roles: ['responsable', 'direction', 'collaborateur'], section: 'pilotage' },
  { to: '/portefeuille', label: 'Mes clients', icon: Briefcase, roles: ['commercial', 'agri_precision', 'commercial_chef_atelier', 'responsable', 'chef_atelier', 'responsable_sav', 'direction'], section: 'activite' },
  { to: '/equipe', label: 'Mon équipe', icon: Users, roles: ['responsable', 'responsable_sav', 'direction'], section: 'activite' },
  { to: '/magasin', label: 'Magasin', icon: Store, roles: ['responsable', 'direction'], section: 'activite' },
  { to: '/sav', label: 'SAV — OP 50 ans', icon: ClipboardCheck, roles: ['chef_atelier', 'commercial_chef_atelier', 'responsable_sav', 'direction'], section: 'atelier' },
  { to: '/lancement', label: 'Lancement', icon: Rocket, roles: ['direction'], section: 'admin' },
  { to: '/utilisateurs', label: 'Utilisateurs', icon: Users, roles: ['direction'], section: 'admin' },
  { to: '/administration', label: 'Administration', icon: Settings, roles: ['direction'], section: 'admin' },
  { to: '/copilot', label: 'Copilot Admin', icon: Bot, roles: ['direction'], section: 'admin' }
];

export default function Layout({ children }) {
  const { user, logout, viewAsRole, setViewAsRole, viewAsCommercial, setViewAsCommercial, viewAsManager, setViewAsManager, viewAsReferent, setViewAsReferent } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Panneau replié : mémorisé sur le poste, pour retrouver sa mise en page.
  const [replie, setReplie] = useState(() => {
    try { return window.localStorage.getItem('cockpitop_menu_replie') === '1'; } catch (e) { return false; }
  });
  const basculerReplie = () => {
    setReplie((v) => {
      const suivant = !v;
      try { window.localStorage.setItem('cockpitop_menu_replie', suivant ? '1' : '0'); } catch (e) { /* ignore */ }
      return suivant;
    });
  };
  const [structure, setStructure] = useState([]);
  const [bases, setBases] = useState([]);
  const role = getAppRole(user, viewAsRole);
  const canViewAs = isDirection(user);

  // Référentiel du « Voir en tant que » : le tableau de répartition (sites, chefs
  // d'atelier, responsables SAV) et les commerciaux. Lu via le cache partagé, avec
  // reprise si la première lecture ne remonte rien (session qui vient de s'ouvrir).
  useEffect(() => {
    if (!canViewAs) return undefined;
    let annule = false;
    const charger = async () => {
      for (let essai = 0; essai < 3 && !annule; essai += 1) {
        const [rows, sites] = await Promise.all([
          listerPartage('structure_commerciale', '-nom_commercial', 200),
          listerPartage('base', '-nom', 100)
        ]);
        if (annule) return;
        setStructure(rows || []);
        setBases(sites || []);
        if ((sites || []).length > 0) return;
        invalider();
        await new Promise((r) => setTimeout(r, 700));
      }
    };
    charger();
    return () => { annule = true; };
  }, [canViewAs]);

  const commercials = structure;
  // Référents d'atelier simulables (démo) : chefs d'atelier et responsables SAV des sites.
  const chefs = useMemo(() => [...new Set(bases.flatMap((b) => b.chefs_atelier || []))].sort(), [bases]);
  const responsablesSav = useMemo(() => [...new Set(bases.flatMap((b) => b.responsables_sav || []))].sort(), [bases]);

  // Dès que le tableau de répartition est connu, la simulation prend le premier
  // référent : le périmètre s'applique sans avoir à rouvrir la liste.
  useEffect(() => {
    if (viewAsRole === 'chef_atelier' && !viewAsReferent && chefs.length > 0) setViewAsReferent(chefs[0]);
    else if (viewAsRole === 'responsable_sav' && !viewAsReferent && responsablesSav.length > 0) setViewAsReferent(responsablesSav[0]);
  }, [viewAsRole, viewAsReferent, chefs, responsablesSav]);
  const managers = useMemo(() => {
    const set = new Set();
    structure.forEach((s) => { if (s.manager) set.add(s.manager); });
    return [...set].sort();
  }, [structure]);

  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  const sections = [...new Set(visibleItems.map((i) => i.section))];

  const handleLogout = () => {
    logout(false);
    navigate('/login');
  };

  const SidebarContent = ({ replie = false }) => (
    <>
      <div className={`border-b border-sidebar-border ${replie ? 'px-3 py-4' : 'px-6 py-6'}`}>
        <div className={`flex flex-col ${replie ? 'items-center' : ''}`}>
          <OpLogo className={`rounded-full object-contain ${replie ? 'h-10 w-10' : 'mb-3 h-16 w-16'}`} fallback={null} />
          {!replie && (
            <>
              <span className="text-xl font-extrabold tracking-tight text-white leading-none">
                CockpitOP
              </span>
              <div className="mt-1.5 h-1.5 w-20 rounded-full bg-gd-orange/90" style={{ transform: 'skewX(-12deg)' }} />
              <span className="mt-2 text-[11px] font-medium uppercase tracking-widest text-gd-orange">
                50 ans Gonnin Duris × New Holland
              </span>
            </>
          )}
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            {!replie && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                {SECTION_LABELS[section]}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.filter((i) => i.section === section).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={replie ? item.label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center rounded-lg py-2.5 text-sm font-medium transition-all ${
                        replie ? 'justify-center px-2' : 'gap-3 px-3'
                      } ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!replie && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {canViewAs && !replie && (
        <div className="px-3 pb-2 space-y-2">
          <div>
            <label className="px-1 mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
              <Eye className="mr-1 inline h-3 w-3" /> Voir en tant que
            </label>
            <Select value={viewAsRole || 'admin'} onValueChange={(v) => {
              setViewAsRole(v === 'admin' ? null : v);
              if (v !== 'commercial') setViewAsCommercial(null);
              if (v !== 'responsable') setViewAsManager(null);
              // Atelier : on part sur le premier référent du tableau de répartition.
              setViewAsReferent(v === 'chef_atelier' ? chefs[0] || null : v === 'responsable_sav' ? responsablesSav[0] || null : null);
              // On suit le profil simulé jusqu'à sa page d'accueil.
              navigate(accueilRole(v === 'admin' ? 'direction' : v));
            }}>
              <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Vue admin (tout)</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="agri_precision">Agriculture de précision</SelectItem>
                <SelectItem value="responsable">Manager / Responsable</SelectItem>
                <SelectItem value="chef_atelier">Chef d'atelier</SelectItem>
                <SelectItem value="responsable_sav">Responsable SAV</SelectItem>
                <SelectItem value="collaborateur">Collaborateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {viewAsRole === 'commercial' && commercials.length > 0 && (
            <div>
              <label className="px-1 mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
                <UserCircle className="mr-1 inline h-3 w-3" /> Commercial (démo)
              </label>
              <Select value={viewAsCommercial || 'all'} onValueChange={(v) => setViewAsCommercial(v === 'all' ? null : v)}>
                <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-sidebar-foreground">
                  <SelectValue placeholder="Tous les commerciaux" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Tous (vue globale)</SelectItem>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nom_commercial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {viewAsRole === 'responsable' && managers.length > 0 && (
            <div>
              <label className="px-1 mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
                <UserCircle className="mr-1 inline h-3 w-3" /> Manager (démo)
              </label>
              <Select value={viewAsManager || 'all'} onValueChange={(v) => setViewAsManager(v === 'all' ? null : v)}>
                <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-sidebar-foreground">
                  <SelectValue placeholder="Tous les managers" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Tous (vue globale)</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {(viewAsRole === 'chef_atelier' || viewAsRole === 'responsable_sav') && (
            <div>
              <label className="px-1 mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
                <UserCircle className="mr-1 inline h-3 w-3" /> {viewAsRole === 'chef_atelier' ? "Chef d'atelier" : 'Responsable SAV'} (démo)
              </label>
              <Select value={viewAsReferent || ''} onValueChange={(v) => setViewAsReferent(v)}>
                <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-sidebar-foreground">
                  <SelectValue placeholder="Choisir un référent" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(viewAsRole === 'chef_atelier' ? chefs : responsablesSav).map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {role === 'direction' && !replie && (
          <div className="mb-2 flex items-center gap-2 px-3">
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">Animation</span>
            <NavLink to="/briefing" title="Briefing animateur" className={({ isActive }) => `flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-gd-orange text-gd-navy-dark' : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-white'}`}>
              <Megaphone className="h-[18px] w-[18px]" />
            </NavLink>
            <NavLink to="/presentation" title="Présentation" className={({ isActive }) => `flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-gd-orange text-gd-navy-dark' : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-white'}`}>
              <Presentation className="h-[18px] w-[18px]" />
            </NavLink>
          </div>
        )}
        <div
          className={`flex items-center py-2 ${replie ? 'justify-center px-0' : 'gap-3 px-3'}`}
          title={replie ? `${user?.full_name || user?.email} — ${ROLE_LABELS[role]}` : undefined}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark font-bold text-sm">
            {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          {!replie && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.full_name || user?.email}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">{ROLE_LABELS[role]}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={replie ? 'Déconnexion' : undefined}
          className={`mt-2 flex w-full items-center rounded-lg py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-white/5 hover:text-white transition-colors ${replie ? 'justify-center px-0' : 'gap-3 px-3'}`}
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!replie && <span>Déconnexion</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between gd-gradient px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold text-white">GONNIN DURIS</span>
          <div className="h-1 w-8 rounded-full bg-gd-orange" style={{ transform: 'skewX(-12deg)' }} />
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white p-1">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 shrink-0 gd-gradient text-sidebar-foreground flex flex-col h-full">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 text-white/70 p-1">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex ${replie ? 'w-20' : 'w-64'} shrink-0 gd-gradient text-sidebar-foreground flex-col fixed inset-y-0 left-0 z-30 transition-[width] duration-200`}>
        <SidebarContent replie={replie} />
        {/* Poignée de repli : donne de la place à la liste des clients */}
        <button
          onClick={basculerReplie}
          title={replie ? 'Déplier le menu' : 'Replier le menu'}
          aria-label={replie ? 'Déplier le menu' : 'Replier le menu'}
          className="absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-gd-navy shadow-md transition hover:bg-gd-orange hover:text-gd-navy-dark"
        >
          {replie ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className={`${replie ? 'lg:ml-20' : 'lg:ml-64'} flex flex-col min-w-0 transition-[margin] duration-200`}>
        {viewAsRole && (
          <div className="flex items-center justify-between border-b border-gd-orange/30 bg-gd-orange/10 px-4 py-2">
            <p className="flex items-center text-sm text-gd-navy">
              <Eye className="mr-1.5 h-4 w-4" />
              Vous visionnez en tant que : <span className="ml-1 font-semibold">{ROLE_LABELS[viewAsRole]}</span>
              {viewAsRole === 'commercial' && viewAsCommercial && (
                <span className="ml-1.5 rounded-full bg-gd-navy px-2 py-0.5 text-xs font-bold text-white">
                  {commercials.find((c) => c.id === viewAsCommercial)?.nom_commercial || ''}
                </span>
              )}
              {viewAsRole === 'responsable' && viewAsManager && (
                <span className="ml-1.5 rounded-full bg-gd-navy px-2 py-0.5 text-xs font-bold text-white">
                  {viewAsManager}
                </span>
              )}
              {viewAsReferent && (viewAsRole === 'chef_atelier' || viewAsRole === 'responsable_sav') && (
                <span className="ml-1.5 rounded-full bg-gd-navy px-2 py-0.5 text-xs font-bold text-white">
                  {viewAsReferent}
                </span>
              )}
            </p>
            <button onClick={() => { setViewAsRole(null); setViewAsCommercial(null); setViewAsManager(null); setViewAsReferent(null); }} className="text-sm text-gd-navy/70 underline hover:text-gd-navy">
              Revenir en vue admin
            </button>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}