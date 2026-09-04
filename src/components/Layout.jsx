import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Briefcase, Users, Calendar, LayoutDashboard, Wrench,
  Store, Settings, LogOut, Menu, X, Eye, Zap
} from 'lucide-react';
import { getAppRole, isDirection } from '@/lib/permissions';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const ROLE_LABELS = {
  commercial: 'Commercial',
  responsable: 'Responsable commercial',
  direction: 'Direction / Marketing',
  collaborateur: 'Collaborateur'
};

const SECTION_LABELS = {
  espace: 'Mon espace',
  pilotage: 'Pilotage',
  activite: 'Activité commerciale',
  atelier: 'Atelier',
  admin: 'Administration'
};

const navItems = [
  { to: '/espace-collaborateur', label: 'Mon espace', icon: Zap, roles: ['collaborateur'], section: 'espace' },
  { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['commercial', 'responsable', 'direction', 'collaborateur'], section: 'pilotage' },
  { to: '/calendrier', label: 'Calendrier', icon: Calendar, roles: ['commercial', 'responsable', 'direction', 'collaborateur'], section: 'pilotage' },
  { to: '/portefeuille', label: 'Mon portefeuille', icon: Briefcase, roles: ['commercial', 'responsable', 'direction'], section: 'activite' },
  { to: '/equipe', label: 'Mon équipe', icon: Users, roles: ['responsable', 'direction'], section: 'activite' },
  { to: '/magasin', label: 'Magasin', icon: Store, roles: ['commercial', 'responsable', 'direction', 'collaborateur'], section: 'activite' },
  { to: '/atelier', label: 'Atelier', icon: Wrench, roles: ['responsable', 'direction'], section: 'atelier' },
  { to: '/utilisateurs', label: 'Utilisateurs', icon: Users, roles: ['direction'], section: 'admin' },
  { to: '/administration', label: 'Administration', icon: Settings, roles: ['direction'], section: 'admin' }
];

export default function Layout({ children }) {
  const { user, logout, viewAsRole, setViewAsRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = getAppRole(user, viewAsRole);
  const canViewAs = isDirection(user);

  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  const sections = [...new Set(visibleItems.map((i) => i.section))];

  const handleLogout = () => {
    logout(false);
    navigate('/login');
  };

  const SidebarContent = () => (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex flex-col">
          <span className="text-xl font-extrabold tracking-tight text-white leading-none">
            GONNIN DURIS
          </span>
          <div className="mt-1.5 h-1.5 w-20 rounded-full bg-gd-orange/90" style={{ transform: 'skewX(-12deg)' }} />
          <span className="mt-2 text-[11px] font-medium uppercase tracking-widest text-gd-orange">
            50 ans New Holland
          </span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
              {SECTION_LABELS[section]}
            </p>
            <div className="space-y-0.5">
              {visibleItems.filter((i) => i.section === section).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {canViewAs && (
        <div className="px-3 pb-2">
          <label className="px-1 mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
            <Eye className="mr-1 inline h-3 w-3" /> Voir en tant que
          </label>
          <Select value={viewAsRole || 'admin'} onValueChange={(v) => setViewAsRole(v === 'admin' ? null : v)}>
            <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-sidebar-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Vue admin (tout)</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="responsable">Responsable</SelectItem>
              <SelectItem value="collaborateur">Collaborateur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark font-bold text-sm">
            {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.full_name || user?.email}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Déconnexion</span>
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
      <aside className="hidden lg:flex w-64 shrink-0 gd-gradient text-sidebar-foreground flex-col fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="lg:ml-64 flex flex-col min-w-0">
        {viewAsRole && (
          <div className="flex items-center justify-between border-b border-gd-orange/30 bg-gd-orange/10 px-4 py-2">
            <p className="flex items-center text-sm text-gd-navy">
              <Eye className="mr-1.5 h-4 w-4" />
              Vous visionnez en tant que : <span className="ml-1 font-semibold">{ROLE_LABELS[viewAsRole]}</span>
            </p>
            <button onClick={() => setViewAsRole(null)} className="text-sm text-gd-navy/70 underline hover:text-gd-navy">
              Revenir en vue admin
            </button>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}