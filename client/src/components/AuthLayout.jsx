import AuthBackground from './AuthBackground.jsx';

export default function AuthLayout({ children }) {
  return (
    <div className="auth-screen">
      <AuthBackground />
      <div className="auth-content">
        {children}
      </div>
    </div>
  );
}
