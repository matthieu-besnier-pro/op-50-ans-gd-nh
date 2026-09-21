import { useAuth } from '@/lib/AuthContext';

export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function getAppRole(user, viewAsRole = null) {
  if (viewAsRole && (user?.role === 'admin' || user?.app_role === 'direction')) {
    return viewAsRole;
  }
  // Un admin technique contrôle TOUT : traité comme Direction dans toute l'app
  // (menu complet, pages d'administration, accès à toutes les données).
  if (user?.role === 'admin') return 'direction';
  return user?.app_role || 'collaborateur';
}

export function isDirection(user, viewAsRole = null) {
  if (viewAsRole) {
    return viewAsRole === 'direction';
  }
  return user?.role === 'admin' || getAppRole(user) === 'direction';
}

export function isResponsable(user) {
  return getAppRole(user) === 'responsable';
}

export function isCommercial(user) {
  return getAppRole(user) === 'commercial';
}

export function canAccessClients(user) {
  const r = getAppRole(user);
  return r === 'commercial' || r === 'responsable' || isDirection(user);
}

export function canAccessEquipe(user) {
  return isResponsable(user) || isDirection(user);
}

export function canAccessAtelier(user) {
  return isResponsable(user) || isDirection(user);
}

export function canAccessAdmin(user) {
  return isDirection(user);
}

export function canEditOperation(user) {
  return isDirection(user);
}

export function canSeePac(user, viewAsRole = null) {
  return isDirection(user, viewAsRole);
}