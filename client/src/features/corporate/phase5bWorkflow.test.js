import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const appSource = read('..', '..', 'App.jsx');
const approvalRouteSource = read('..', '..', 'components', 'auth', 'ApprovalRoute.jsx');
const navigationSource = read('..', '..', 'components', 'layout', 'navigationItems.jsx');
const adminReportsSource = read('..', 'admin', 'AdminReportsPage.jsx');
const approvalsSource = read('CorporateApprovalsPage.jsx');
const requesterSource = read('CorporateCateringPage.jsx');
const requesterSkeletonSource = read('CorporateCateringSkeleton.jsx');
const requesterCss = read('corporate-catering.css');
const vendorOpsSource = read('..', 'vendor', 'VendorOperationsPage.jsx');
const vendorLayoutSource = read('..', 'vendor', 'VendorWorkspaceLayout.jsx');
const vendorCateringSource = read('..', 'vendor', 'VendorCateringPage.jsx');

test('finance is a guarded approval surface and corporate routes are mounted', () => {
  assert.ok(appSource.includes('<Route element={<ApprovalRoute />}>'));
  assert.ok(appSource.includes('<Route path="/finance" element={<CorporateApprovalsPage />} />'));
  assert.ok(appSource.includes('<Route path="/admin/corporate-approvals" element={<CorporateApprovalsPage />} />'));
  assert.ok(appSource.includes('<Route path="/corporate" element={<CorporateCateringPage />} />'));
  assert.ok(appSource.includes('<Route path="/vendor/catering" element={<Navigate to="/vendor?view=catering" replace />} />'));
  assert.ok(approvalRouteSource.includes("const APPROVAL_ROLES = ['admin', 'finance'];"));
  assert.ok(approvalRouteSource.includes('if (sessionIssue) return <SessionExpiredScreen redirectTo={redirectTo} />;'));
  assert.ok(approvalRouteSource.includes('if (!roles.some((role) => APPROVAL_ROLES.includes(role)))'));
  assert.ok(approvalRouteSource.includes('<Navigate to="/" replace />'));
});

test('requester navigation is consolidated and the live corporate report replaces the mock', () => {
  assert.ok(navigationSource.includes("roles: ['catering_requester']"));
  assert.doesNotMatch(navigationSource, /roles: \['executive'/);
  assert.ok(adminReportsSource.includes("import { getCorporateReport } from '../../services/corporateApi.js';"));
  assert.ok(adminReportsSource.includes('getCorporateReport({ token, signal: controller.signal })'));
  assert.doesNotMatch(adminReportsSource, /CORPORATE_REPORT/);
  assert.ok(adminReportsSource.includes('No corporate orders yet'));
  assert.ok(adminReportsSource.includes('No upcoming events'));
});

test('approver UI shows sequence two context for quote re-approval', () => {
  assert.ok(approvalsSource.includes("import { useSearchParams } from 'react-router-dom';"));
  assert.ok(approvalsSource.includes("searchParams.get('orderId')"));
  assert.ok(approvalsSource.includes("reapprovalRequired ? 'Quote re-approval'"));
  assert.ok(approvalsSource.includes('Accepted quote total'));
  assert.ok(approvalsSource.includes('exceeds the originally approved charge'));
});

test('requester UI exposes quote, re-approval, and delivery confirmation actions', () => {
  for (const action of [
    'Accept quote',
    'Decline quote',
    'Request re-approval',
    'Confirm delivery',
    'Re-approval required',
  ]) {
    assert.ok(requesterSource.includes(action), `missing requester action ${action}`);
  }
  assert.ok(requesterSource.includes('acceptCorporateQuote(quote.id, { token })'));
  assert.ok(requesterSource.includes('rejectCorporateQuote('));
  assert.ok(requesterSource.includes('requestCorporateReapproval('));
  assert.ok(requesterSource.includes('confirmCorporateDelivery('));
});

test('requester form uses the shared dropdown, input, and skeleton patterns', () => {
  assert.ok(requesterSource.includes("import CustomDropdown from '../../components/ui/CustomDropdown.jsx';"));
  assert.equal((requesterSource.match(/<CustomDropdown/g) || []).length, 2);
  assert.equal((requesterSource.match(/className="admin-input"/g) || []).length, 16);
  assert.doesNotMatch(requesterSource, /<select\b/);
  assert.ok(requesterSource.includes('function RequestSkeleton()'));
  assert.ok(requesterSource.includes('function MenuSkeleton()'));
  assert.ok(requesterSource.includes('const [loadingDetail, setLoadingDetail]'));
  assert.ok(requesterSource.includes('<RequestSkeleton key={index} />'));
  assert.ok(requesterSource.includes('<MenuSkeleton key={index} />'));
  assert.ok(requesterCss.includes('.corporate-skeleton-line'));
  assert.ok(requesterCss.includes('.corporate-menu-skeletons'));
});

test('requester initial load uses a full page skeleton', () => {
  assert.ok(requesterSource.includes("import CorporateCateringSkeleton from './CorporateCateringSkeleton.jsx';"));
  assert.ok(requesterSource.includes('if (rolesLoading) return <CorporateCateringSkeleton />;'));
  assert.ok(requesterSource.includes('if (loadingVendors) return <CorporateCateringSkeleton />;'));
  assert.ok(requesterSkeletonSource.includes('className="corporate-skeleton-page"'));
  assert.ok(requesterSkeletonSource.includes('className="corporate-layout"'));
  assert.ok(requesterSkeletonSource.includes('corporate-skeleton-control'));
  assert.ok(requesterSkeletonSource.includes('corporate-request-skeletons'));
  assert.ok(requesterCss.includes('.corporate-skeleton-page'));
  assert.ok(requesterCss.includes('.corporate-skeleton-control'));
});

test('vendor Catering workspace is manager-only and covers quote through delivery', () => {
  assert.ok(vendorLayoutSource.includes("{ view: 'catering', label: 'Catering', Icon: IconBuilding }"));
  assert.ok(vendorLayoutSource.includes("const items = role === 'manager' ? [OVERVIEW_ITEM, ...MANAGER_ITEMS] : [OVERVIEW_ITEM];"));
  assert.ok(vendorOpsSource.includes("searchParams.get('view') === 'catering'"));
  assert.ok(vendorOpsSource.includes("if (showingManagerView && selectedVendor?.role !== 'manager' && vendorsState === 'ready')"));
  for (const action of [
    'Save draft',
    'Submit quote',
    'Withdraw quote',
    'Dispatch order',
    'Dispatch',
    'Mark delivered',
  ]) {
    assert.ok(vendorCateringSource.includes(action), `missing vendor action ${action}`);
  }
  assert.ok(vendorCateringSource.includes("['payment_confirmed', 'preparing'].includes(detail.request.orderStatus)"));
});
