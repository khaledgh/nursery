import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";

// Admin panel is for staff: parents are bounced even with a valid token
// (the API enforces this server-side regardless).
export function ProtectedRoute() {
  const { accessToken, user } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (user.role === "parent") return <Navigate to="/login" replace />;
  return <Outlet />;
}
