import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegisterFromCCTVPage } from "./pages/RegisterFromCCTVPage";
import { RecognizePage } from "./pages/RecognizePage";
import { LiveSnapshotPage } from "./pages/LiveSnapshotPage";
import { PeoplePage } from "./pages/PeoplePage";
import { AttendancePage } from "./pages/AttendancePage";
import { CamerasPage } from "./pages/CamerasPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { SettingsPage } from "./pages/SettingsPage";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Main App Layout */}
          <Route path="/" element={<AppLayout />}>
            {/* Menu Utama (Terbuka untuk umum / Kiosk) */}
            <Route index element={<DashboardPage />} />
            <Route path="recognize" element={<RecognizePage />} />
            <Route path="live-snapshot" element={<LiveSnapshotPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="attendance" element={<AttendancePage />} />

            {/* Menu Sistem & Konfigurasi (Hanya untuk Admin) */}
            <Route
              path="register-cctv"
              element={
                <ProtectedRoute>
                  <RegisterFromCCTVPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="cameras"
              element={
                <ProtectedRoute>
                  <CamerasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="schedules"
              element={
                <ProtectedRoute>
                  <SchedulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
