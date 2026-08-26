/**
 * Responsive page content container.
 * Owns horizontal padding, max-width and clearance above the mobile bottom nav.
 */
export default function PageContainer({ children, className = '' }) {
  return <div className={`page-container ${className}`.trim()}>{children}</div>;
}
