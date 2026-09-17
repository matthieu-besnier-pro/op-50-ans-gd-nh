import { Toaster } from "@/components/ui/toaster"
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
// Page imports
import MonPortefeuille from '@/pages/MonPortefeuille';
import MonEquipe from '@/pages/MonEquipe';
import Calendrier from '@/pages/Calendrier';
import TableauDeBord from '@/pages/TableauDeBord';
import Atelier from '@/pages/Atelier';
import Magasin from '@/pages/Magasin';
import Administration from '@/pages/Administration';
import ClientDetail from '@/pages/ClientDetail';
import EspaceCollaborateur from '@/pages/EspaceCollaborateur';
import GestionUtilisateurs from '@/pages/GestionUtilisateurs';
import GrandEcran from '@/pages/GrandEcran';
import BriefingAnimateur from '@/pages/BriefingAnimateur';
import Presentation from '@/pages/Presentation';
import CopilotAdmin from '@/pages/CopilotAdmin';
import Lancement from '@/pages/Lancement';
import { getAppRole } from '@/lib/permissions';

const HomeRedirect = () => {
  const { user, viewAsRole } = useAuth();
  const role = getAppRole(user, viewAsRole);
  if (role === 'collaborateur') return <Navigate to="/espace-collaborateur" replace />;
  return <Navigate to="/tableau-de-bord" replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/espace-collaborateur" element={<EspaceCollaborateur />} />
        <Route path="/portefeuille" element={<MonPortefeuille />} />
        <Route path="/equipe" element={<MonEquipe />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/tableau-de-bord" element={<TableauDeBord />} />
        <Route path="/atelier" element={<Atelier />} />
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