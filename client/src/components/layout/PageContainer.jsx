/**
 * Responsive page content container.
 * Owns horizontal padding, max-width and clearance above the mobile bottom nav.
 * Pass noPad to skip padding (for pages that manage their own).
 */
export default function PageContainer({ children, className = '', noPad = false }) {
  return (
    <div className={`page-container${noPad ? ' page-container--no-pad' : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}
