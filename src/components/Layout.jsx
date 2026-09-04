import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Briefcase, Users, Calendar, LayoutDashboard, Wrench,
  Store, Settings, LogOut, Menu, X
} from 'lucide-react';
import { getAppRole } from '@/lib/permissions';

const ROLE_LABELS = {
  commercial: 'Commercial',
  responsable: 'Responsable commercial',
  direction: 'Direction / Marketing',
  collaborateur: 'Collaborateur'
};

const navItems = [
  { to: '/portefeuille', label: 'Mon portefeuille', icon: Briefcase, roles: ['commercial', 'responsable', 'direction'] },
  { to: '/equipe', label: 'Mon équipe', icon: Users, roles: ['responsable', 'direction'] },
  { to: '/calendrier', label: 'Calendrier', icon: Calendar, roles: ['commercial', 'responsable', 'direction', 'collaborateur'] },
  { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['commercial', 'responsable', 'direction', 'collaborateur'] },
  { to: '/atelier', label: 'Atelier', icon: Wrench, roles: ['responsable', 'direction'] },
  { to: '/magasin', label: 'Magasin', icon: Store, roles: ['commercial', 'responsable', 'direction', 'collaborateur'] },
  { to: '/administration', label: 'Administration', icon: Settings, roles: ['direction'] }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = getAppRole(user);

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
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
      </nav>
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
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}