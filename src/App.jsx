import { Toaster } from "@/components/ui/toaster"
import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Pages chargées à la demande : chaque écran n'est téléchargé que lorsqu'on l'ouvre
// (le premier affichage ne charge plus tout l'outil en une seule fois).
const MonPortefeuille = lazy(() => import('@/pages/MonPortefeuille'));
const MonEquipe = lazy(() => import('@/pages/MonEquipe'));
const Calendrier = lazy(() => import('@/pages/Calendrier'));
const TableauDeBord = lazy(() => import('@/pages/TableauDeBord'));
const Atelier = lazy(() => import('@/pages/Atelier'));
const Sav = lazy(() => import('@/pages/Sav'));
const Magasin = lazy(() => import('@/pages/Magasin'));
const Administration = lazy(() => import('@/pages/Administration'));
const ClientDetail = lazy(() => import('@/pages/ClientDetail'));
const EspaceCollaborateur = lazy(() => import('@/pages/EspaceCollaborateur'));
const GestionUtilisateurs = lazy(() => import('@/pages/GestionUtilisateurs'));
const GrandEcran = lazy(() => import('@/pages/GrandEcran'));
const BriefingAnimateur = lazy(() => import('@/pages/BriefingAnimateur'));
const Presentation = lazy(() => import('@/pages/Presentation'));
const CopilotAdmin = lazy(() => import('@/pages/CopilotAdmin'));
const Lancement = lazy(() => import('@/pages/Lancement'));
const EspaceCommercial = lazy(() => import('@/pages/EspaceCommercial'));
import Loader from '@/components/Loader';
import { getAppRole, accueilRole } from '@/lib/permissions';

const HomeRedirect = () => {
  const { user, viewAsRole } = useAuth();
  return <Navigate to={accueilRole(getAppRole(user, viewAsRole))} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader label="Démarrage de CockpitOP…" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={(
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader label="Ouverture du module…" />
      </div>
    )}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/espace-collaborateur" element={<EspaceCollaborateur />} />
        <Route path="/mon-espace" element={<EspaceCommercial />} />
        <Route path="/portefeuille" element={<MonPortefeuille />} />
        <Route path="/equipe" element={<MonEquipe />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/tableau-de-bord" element={<TableauDeBord />} />
        <Route path="/atelier" element={<Atelier />} />
        <Route path="/sav" element={<Sav />} />
        <Route path="/magasin" element={<Magasin />} />
        <Route path="/administration" element={<Administration />} />
        <Route path="/utilisateurs" element={<GestionUtilisateurs />} />
        <Route path="/client/:id" element={<ClientDetail />} />
        <Route path="/grand-ecran" element={<GrandEcran />} />
        <Route path="/briefing" element={<BriefingAnimateur />} />
        <Route path="/presentation" element={<Presentation />} />
        <Route path="/copilot" element={<CopilotAdmin />} />
        <Route path="/lancement" element={<Lancement />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App