import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconBriefcase, IconBuildingStore, IconCalendarEvent, IconCash, IconCheck, IconChevronLeft, IconCoins, IconFileSearch, IconHeadset, IconIdBadge, IconMail, IconNotebook, IconSchool, IconShield, IconShieldCheck, IconUser, IconX } from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import SkeletonTable from '../../components/ui/SkeletonTable.jsx';
import { getUserRoles, setUserRoles } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import ModalProgressOverlay from './ModalProgressOverlay.jsx';
import { ALL_ROLES, ASSIGNABLE_ROLES, LEGACY_REQUESTER_ROLES } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';

const ROLE_HINTS = { admin: 'Full platform control and configuration access.', catering_requester: 'Submit, review and manage corporate catering requests.', executive: 'Legacy catering requester role. Use Catering Requester for new grants.', finance: 'Settlement, reconciliation, refunds and corporate approvals.', support: 'Order intervention, complaints and customer messages.', vendor_staff: 'Manage assigned vendor orders and menu updates.', vendor_manager: 'Vendor profile, staff and operating hours.', employee: 'Standard ordering and collection.', executive_assistant: 'Legacy catering requester role. Use Catering Requester for new grants.', meeting_organiser: 'Legacy catering requester role. Use Catering Requester for new grants.', training_coordinator: 'Legacy catering requester role. Use Catering Requester for new grants.', cost_centre_owner: 'Legacy catering requester role. Use Catering Requester for new grants.', auditor: 'Read-only review of operational activity and audit records.' };
function Avatar({ name = '' }) { return <span className="admin-user-avatar admin-user-avatar--lg" style={{ width: 72, height: 72, fontSize: 26 }}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>; }
function RoleBadge({ role, vendorRoles = [] }) { const config = ALL_ROLES.find((item) => item.id === role); return <span className={`admin-tag admin-tag--${config?.tone || 'info'}`} title={vendorRoles.includes(role) ? 'From active vendor membership' : undefined}>{config?.label || role}</span>; }
const ROLE_ICONS = { admin: IconShieldCheck, catering_requester: IconBriefcase, executive: IconBriefcase, finance: IconCash, support: IconHeadset, vendor_staff: IconBuildingStore, vendor_manager: IconBriefcase, employee: IconUser, executive_assistant: IconNotebook, meeting_organiser: IconCalendarEvent, training_coordinator: IconSchool, cost_centre_owner: IconCoins, auditor: IconFileSearch };
function RoleItem({ role, vendorRoles = [] }) { const config = ALL_ROLES.find((item) => item.id === role); const Icon = ROLE_ICONS[role] || IconShield; const fromVendor = vendorRoles.includes(role); return <div className="admin-role-item"><span className={`admin-role-item__icon admin-role-item__icon--${config?.tone || 'info'}`}><Icon size={18} stroke={1.7} /></span><div className="admin-role-item__body"><span className="admin-role-item__name">{config?.label || role}</span><span className="admin-role-item__hint">{fromVendor ? 'From active vendor membership. Manage it in the vendor’s team settings.' : ROLE_HINTS[role] || 'Platform access role.'}</span></div><span className="admin-role-item__check"><IconCheck size={13} stroke={2.5} /></span></div>; }

function RoleAssignmentModal({ user, roles, vendorRoles = [], onSave, onCancel, saving }) {
  const [selected, setSelected] = useState(roles);
  const toggle = (role) => setSelected((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  if (!user) return null;
  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onCancel} /><div className="admin-modal__card admin-role-modal"><header className="admin-role-modal__head"><div className="admin-role-modal__icon"><IconShield size={20} stroke={1.7} /></div><div className="admin-role-modal__head-text"><h3 className="admin-role-modal__title">Manage roles</h3><p className="admin-role-modal__sub">{user.full_name || user.email}</p></div><button type="button" className="admin-role-modal__close" onClick={onCancel} aria-label="Close"><IconX size={16} /></button></header><div className="admin-role-modal__desc">Select the platform roles this user should retain. Changes are applied immediately.</div>{vendorRoles.length > 0 && <p className="admin-role-modal__note">Vendor roles ({vendorRoles.map((role) => ALL_ROLES.find((item) => item.id === role)?.label || role).join(', ')}) come from active vendor memberships and are managed in the vendor’s team settings.</p>}{LEGACY_REQUESTER_ROLES.some((role) => selected.includes(role.id)) && <p className="admin-role-modal__note">Legacy catering requester roles remain visible for this user but cannot be assigned. Use Catering Requester for new grants.</p>}<div className="admin-role-modal__body">{ASSIGNABLE_ROLES.map((role) => { const checked = selected.includes(role.id); const Icon = ROLE_ICONS[role.id] || IconShield; return <div key={role.id} role="button" tabIndex={0} onClick={() => toggle(role.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(role.id); } }} className={`admin-role-option${checked ? ' admin-role-option--selected' : ''}`}><input type="checkbox" tabIndex={-1} checked={checked} onClick={(e) => e.stopPropagation()} onChange={() => toggle(role.id)} className="admin-role-option__checkbox" /><span className={`admin-role-option__icon admin-role-option__icon--${role.tone}`}><Icon size={17} stroke={1.7} /></span><span className="admin-role-option__text"><span className="admin-role-option__name">{role.label}</span><span className="admin-role-option__hint">{ROLE_HINTS[role.id] || 'Platform access role.'}</span></span>{checked && <span className="admin-role-option__selected"><IconCheck size={12} stroke={2.75} /> Selected</span>}</div>; })}</div><footer className="admin-role-modal__foot"><button type="button" className="admin-action" onClick={onCancel}>Cancel</button><button type="button" className="admin-action admin-action--approve" onClick={() => onSave(selected)} disabled={saving}><IconCheck size={13} /> {saving ? 'Saving…' : 'Save changes'}</button></footer><ModalProgressOverlay active={saving} messages={['Updating roles...', 'Applying access changes...', 'Almost there...']} /></div></div>;
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const { session } = useAuth();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [platformRoles, setPlatformRoles] = useState([]);
  const [vendorRoles, setVendorRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!session?.access_token || !userId) return;
    setLoading(true); setError('');
    try {
      const response = await getUserRoles(session.access_token, userId);
      setUser(response.user);
      setRoles(response.roles || []);
      setPlatformRoles(response.platformRoles || response.roles || []);
      setVendorRoles(response.vendorRoles || []);
    } catch (err) { setError(err.message || 'Could not load user.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [session?.access_token, userId]);
  const saveRoles = async (nextRoles) => {
    setSaving(true);
    try {
      const assignableIds = new Set(ASSIGNABLE_ROLES.map((role) => role.id));
      const preservedLegacy = LEGACY_REQUESTER_ROLES
        .filter((role) => platformRoles.includes(role.id))
        .map((role) => role.id);
      const submittedRoles = [...new Set([
        ...nextRoles.filter((role) => assignableIds.has(role)),
        ...preservedLegacy,
      ])];
      const response = await setUserRoles(session.access_token, userId, submittedRoles);
      const savedPlatformRoles = response.platformRoles || response.roles || submittedRoles;
      setPlatformRoles(savedPlatformRoles);
      setRoles([...new Set([...savedPlatformRoles, ...vendorRoles])]);
      setAssigning(false);
    } catch (err) { setError(err.message || 'Could not update roles.'); } finally { setSaving(false); }
  };

  if (loading) return <div className="admin-user-detail-wrapper"><Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Users', to: '/admin/users' }, { label: 'Loading...' }]} /><section className="admin-user-hero"><div className="admin-user-hero__avatar"><span className="skeleton" style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)' }} /></div><div className="admin-user-hero__info"><div className="admin-user-hero__head"><span className="skeleton skeleton--kpi-value" style={{ width: 100 }} /></div><div className="skeleton skeleton--title" style={{ width: '35%', marginTop: 8 }} /><div className="skeleton skeleton--text" style={{ width: '45%', marginTop: 8 }} /></div></section><SkeletonTable rows={4} columns={3} /></div>;
  if (!user || error) return <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>User not found</h3><p>{error || 'The user profile may have been archived.'}</p><Link to="/admin/users" className="admin-action--ghost"><IconChevronLeft size={13} /> Back to users</Link></div>;

  return <div className="admin-user-detail-wrapper"><Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Users', to: '/admin/users' }, { label: user.full_name || user.email }]} /><section className="admin-user-hero"><div className="admin-user-hero__avatar"><Avatar name={user.full_name || user.email} /></div><div className="admin-user-hero__info"><div className="admin-user-hero__head"><span className="admin-user-hero__slug"><IconIdBadge size={13} stroke={1.8} />{user.employee_number || 'No employee number'}</span><span className="admin-status admin-status--success">Profile loaded</span></div><h2 className="admin-user-hero__name">{user.full_name || 'Unnamed user'}</h2><span className="admin-user-hero__email"><IconMail size={13} stroke={1.8} />{user.email}</span><div className="admin-user-hero__roles">{roles.length ? roles.map((role) => <RoleBadge key={role} role={role} vendorRoles={vendorRoles} />) : <span className="admin-tag">No roles</span>}</div></div><div className="admin-order-hero__actions"><button type="button" className="admin-action--ghost" onClick={() => setAssigning(true)}><IconShield size={14} /> Manage roles</button></div></section><div className="admin-user-detail-grid"><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Access</span><h3 className="admin-card__title">Assigned roles</h3></div></header><div className="admin-user-detail-sections">{roles.length ? <div className="admin-role-panel"><div className="admin-role-panel__meta"><span className="admin-role-panel__count">{roles.length} role{roles.length === 1 ? '' : 's'} assigned</span><span className="admin-role-panel__hint">Platform roles and active vendor memberships control what this user can access.</span></div><div className="admin-role-panel__list">{roles.map((role) => <RoleItem key={role} role={role} vendorRoles={vendorRoles} />)}</div></div> : <p className="admin-vendor-empty-copy">No roles assigned.</p>}</div></section></div><RoleAssignmentModal user={assigning ? user : null} roles={platformRoles} vendorRoles={vendorRoles} onSave={saveRoles} onCancel={() => setAssigning(false)} saving={saving} /></div>;
}
