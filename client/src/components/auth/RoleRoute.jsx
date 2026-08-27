import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';

/**
 * Route guard that checks authentication AND role.
 *
 * Usage:
 *   <Route element={<RoleRoute allowedRoles={['admin']} />}>
 *     <Route path="/admin/*" element={<AdminPortal />} />
 *   </Route>
 *
 *   <Route element={<RoleRoute allowedRoles={['vendor_staff', 'vendor_manager']} />}>
 *     <Route path="/vendor/*" element={<VendorPortal />} />
 *   </Route>
 */
export default function RoleRoute({ allowedRoles = [] }) {
  const { user, initialized } = useAuth();
  const { roles, loading } = useRoles();

  if (!initialized || loading) {
    return (
      <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Checking permissions...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !roles.some((r) => allowedRoles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
