import { useState, useMemo } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import SplashScreen from './features/auth/SplashScreen.jsx';
import Onboarding from './features/onboarding/Onboarding.jsx';
import AuthLayout from './components/AuthLayout.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import AdminRoute from './components/auth/AdminRoute.jsx';
import ApplicationHeader from './components/layout/ApplicationHeader.jsx';
import MobileBottomNav from './components/layout/MobileBottomNav.jsx';
import PageContainer from './components/layout/PageContainer.jsx';
import Login from './features/auth/Login.jsx';
import Signup from './features/auth/Signup.jsx';
import ForgotPassword from './features/auth/ForgotPassword.jsx';
import AuthCallback from './features/auth/AuthCallback.jsx';
import EmailConfirmation from './features/auth/EmailConfirmation.jsx';
import PasswordRecovery from './features/auth/PasswordRecovery.jsx';
import HomePage from './features/home/HomePage.jsx';
import CafeteriaPage from './features/cafeteria/CafeteriaPage.jsx';
import BrowseCafeteriaPage from './features/cafeteria/BrowseCafeteriaPage.jsx';
import ViewFoodPage from './features/cafeteria/ViewFoodPage.jsx';
import CartPage from './features/cart/CartPage.jsx';
import OrdersPage from './features/orders/OrdersPage.jsx';
import OrderDetailPage from './features/orders/OrderDetailPage.jsx';
import ProfilePage from './features/profile/ProfilePage.jsx';
import AdminLayout from './features/admin/AdminLayout.jsx';
import AdminDashboardPage from './features/admin/AdminDashboardPage.jsx';
import AdminVendorList from './features/admin/AdminVendorList.jsx';
import AdminVendorDetail from './features/admin/AdminVendorDetail.jsx';
import AdminOrderList from './features/admin/AdminOrderList.jsx';
import AdminOrderDetail from './features/admin/AdminOrderDetail.jsx';
import AdminUserList from './features/admin/AdminUserList.jsx';
import AdminUserDetail from './features/admin/AdminUserDetail.jsx';
import AdminCafeteriaList from './features/admin/AdminCafeteriaList.jsx';
import AdminCafeteriaDetail from './features/admin/AdminCafeteriaDetail.jsx';
import AdminReportsPage from './features/admin/AdminReportsPage.jsx';
import AdminAuditLogPage from './features/admin/AdminAuditLogPage.jsx';
import AdminComplaintsPage from './features/admin/AdminComplaintsPage.jsx';
import AdminComplaintDetail from './features/admin/AdminComplaintDetail.jsx';
import AdminAnnouncementsPage from './features/admin/AdminAnnouncementsPage.jsx';
import AdminAnnouncementDetail from './features/admin/AdminAnnouncementDetail.jsx';
import AdminSettingsPage from './features/admin/AdminSettingsPage.jsx';
import './features/auth/auth.css';

function isOnboardingCompleted(profile) {
  return profile?.notification_preferences?.onboarding_completed === true;
}

/** Shared shell for authenticated pages: header + routed content + mobile nav. */
function AppLayout() {
  return (
    <div className="app-shell">
      <ApplicationHeader />
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <PageContainer>
      <h2 style={{ margin: 'var(--space-8) 0' }}>{title} — coming soon</h2>
    </PageContainer>
  );
}

export default function App() {
  const { user, profile, initialized } = useAuth();
  const [phase, setPhase] = useState('splash');

  const shouldShowOnboarding = useMemo(() => {
    if (!initialized) return false;
    if (phase !== 'home') return false;
    if (user && isOnboardingCompleted(profile)) return false;
    return true;
  }, [initialized, phase, user, profile]);

  if (phase === 'splash') {
    return <SplashScreen onComplete={() => setPhase('home')} />;
  }

  if (phase === 'home' && shouldShowOnboarding) {
    return <Onboarding onComplete={() => setPhase('app')} />;
  }

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
      </Route>

      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<EmailConfirmation />} />
      <Route path="/auth/recovery" element={<PasswordRecovery />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/cafeterias" element={<CafeteriaPage />} />
          <Route path="/cafeterias/:cafeteriaId" element={<BrowseCafeteriaPage />} />
          <Route path="/cafeterias/:cafeteriaId/menu/:menuItemId" element={<ViewFoodPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/corporate" element={<PlaceholderPage title="Corporate Catering" />} />
          <Route path="/vendor" element={<PlaceholderPage title="Vendor Dashboard" />} />
        </Route>
      </Route>

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/vendors" element={<AdminVendorList />} />
          <Route path="/admin/vendors/:vendorId" element={<AdminVendorDetail />} />
          <Route path="/admin/cafeterias" element={<AdminCafeteriaList />} />
          <Route path="/admin/cafeterias/:locationId" element={<AdminCafeteriaDetail />} />
          <Route path="/admin/users" element={<AdminUserList />} />
          <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
          <Route path="/admin/orders" element={<AdminOrderList />} />
          <Route path="/admin/orders/:orderId" element={<AdminOrderDetail />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
          <Route path="/admin/complaints/:complaintId" element={<AdminComplaintDetail />} />
          <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
          <Route path="/admin/announcements/:announcementId" element={<AdminAnnouncementDetail />} />
          <Route path="/admin/audit" element={<AdminAuditLogPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/finance" element={<PlaceholderPage title="Finance" />} />
          <Route path="/support" element={<PlaceholderPage title="Support Centre" />} />
          <Route path="/audit" element={<PlaceholderPage title="Audit Logs" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
