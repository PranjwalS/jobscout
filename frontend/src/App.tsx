import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardLayout from "./pages/DashboardLayout";
import OverviewPage from "./pages/OverviewPage";
import MasterDashboardPage from "./pages/MasterDashboardPage";
import CareerTwinInfoPage from "./pages/CareerTwinInfoPage";
import CareerTwinProfilePage from "./pages/CareerTwinProfilePage";
import CVPage from "./pages/CVPage";
import CoverLetterPage from "./pages/CoverLetterPage";
import NewDashboardPage from "./pages/NewDashboardPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* All dashboard routes share the sidebar layout */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="jobs" element={<MasterDashboardPage />} />
          <Route path="careertwin/profile" element={<CareerTwinProfilePage />} />
          <Route path="careertwin/info" element={<CareerTwinInfoPage />} />
          <Route path="products/cv" element={<CVPage />} />
          <Route path="products/coverletter" element={<CoverLetterPage />} />
          {/* Wizard lives inside the dashboard layout so sidebar stays visible */}
          <Route path="new" element={<NewDashboardPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}