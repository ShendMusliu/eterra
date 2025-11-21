// src/routes/AppRouter.tsx
import React, { useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/Login";
import ApplyStudent from "../pages/public/ApplyStudent";
import ApplyWork from "../pages/public/ApplyWork";
import ReserveSportsField from "../pages/public/ReserveSportsField";
// ... import your dashboard and tool pages as needed
import Header from "../components/Header";
import Dashboard from "../pages/Dashboard";
import DeviceLoan from "../pages/dashboard/DeviceLoan";
import DeviceLoanRequestDetail from "../pages/dashboard/DeviceLoanRequestDetail";
import PCLabReservationDetail from "../pages/dashboard/PCLabReservationDetail";
import PCLabReservationPage from "../pages/dashboard/PCLabReservation";
import Profile from "../pages/Profile";
import UserRoleAssignmentsPage from "../pages/admin/UserRoleAssignments";
import StudentProfilesPage from "../pages/admin/StudentProfiles";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserAccess } from "@/hooks/useUserAccess";
import Loader from "@/components/Loader";
import type { AppPermission } from "../../shared/accessControl";

function PrivateRoute({
  children,
  allowed,
  allowedPermissions,
}: {
  children: React.ReactNode;
  allowed?: string[];
  allowedPermissions?: readonly AppPermission[];
}) {
  const { user, loading } = useAuthUser();
  const {
    loading: accessLoading,
    roles,
    canAny,
  } = useUserAccess();
  const location = useLocation();

  const normalizedRoles = useMemo(() => new Set(roles.map((role) => role.toLowerCase())), [roles]);
  const legacyAllowed = useMemo(() => {
    if (!allowed || allowed.length === 0) return true;
    return allowed.some((role) => normalizedRoles.has(role.toLowerCase()));
  }, [allowed, normalizedRoles]);
  const permissionsAllowed = allowedPermissions ? canAny(allowedPermissions) : true;

  if (loading || accessLoading) {
    return <Loader variant="page" />;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!legacyAllowed || !permissionsAllowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ConditionalHeader() {
  const location = useLocation();
  const hideHeaderPaths = ["/login"];

  if (hideHeaderPaths.includes(location.pathname)) {
    return null;
  }

  return <Header />;
}

export default function AppRouter() {
  return (
    <Router>
      <div className="flex min-h-screen flex-col bg-background">
        <ConditionalHeader />
        <main className="flex-1">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/apply-student" element={<ApplyStudent />} />
            <Route path="/apply-work" element={<ApplyWork />} />
            <Route path="/reserve-sports-field" element={<ReserveSportsField />} />

            {/* Protected dashboard */}
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/device-loan"
              element={
                <PrivateRoute
                  allowed={["Student", "Teacher", "Admin"]}
                  allowedPermissions={["deviceLoan.request"]}
                >
                  <DeviceLoan />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/reserve-sports-field"
              element={
                <PrivateRoute>
                  <ReserveSportsField />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/pc-lab-reservation"
              element={
                <PrivateRoute
                  allowed={["Teacher", "Admin", "ITAdmins"]}
                  allowedPermissions={["pcLab.request"]}
                >
                  <PCLabReservationPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/pc-lab-reservations/:reservationId"
              element={
                <PrivateRoute
                  allowed={["Admin", "ITAdmins"]}
                  allowedPermissions={["pcLab.manage"]}
                >
                  <PCLabReservationDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/device-loan/:requestId"
              element={
                <PrivateRoute>
                  <DeviceLoanRequestDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/user-roles"
              element={
                <PrivateRoute
                  allowed={["Admin", "ITAdmins"]}
                  allowedPermissions={["roleAssignments.manage"]}
                >
                  <UserRoleAssignmentsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/student-profiles"
              element={
                <PrivateRoute
                  allowed={["Admin", "HR"]}
                  allowedPermissions={["studentProfiles.manage"]}
                >
                  <StudentProfilesPage />
                </PrivateRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}


