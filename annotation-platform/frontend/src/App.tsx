import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/features/auth/LoginPage";
import DashboardPage from "@/features/dashboard/DashboardPage";
import ProjectListPage from "@/features/projects/ProjectListPage";
import ImageListPage from "@/features/images/ImageListPage";
import StatsPage from "@/features/stats/StatsPage";
import TrashPage from "@/features/trash/TrashPage";
import CategoryPage from "@/features/categories/CategoryPage";
import ExportPage from "@/features/export/ExportPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectListPage />} />
        <Route path="projects/:pid/images" element={<ImageListPage />} />
        <Route path="projects/:pid/categories" element={<CategoryPage />} />
        <Route path="projects/:pid/export" element={<ExportPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="trash" element={<TrashPage />} />
      </Route>
    </Routes>
  );
}
