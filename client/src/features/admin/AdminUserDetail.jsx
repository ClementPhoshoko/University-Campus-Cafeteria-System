import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconCheck, IconChevronLeft, IconInfoCircle, IconMail, IconShield, IconUser } from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import { getUserRoles, setUserRoles } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ALL_ROLES } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const ROLE_HINTS = { admin: 'Full platform control and configuration access.', finance: 'Settlement, reconciliation and refund processing.', support: 'Order intervention, complaints and customer messages.', vendor_staff: 'Manage assigned vendor orders and menu updates.', vendor_manager: 'Vendor profile, staff and operating hours.', employee: 'Standard ordering and collection.', executive_assistant: 'Order on behalf of executives.', meeting_organiser: 'Submit and track corporate catering orders.' };
function Avatar({ name = '' }) { return <span className="admin-user-avatar admin-user-avatar--lg" style={{ width: 72, height: 72, fontSize: 26 }}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>; }
function RoleBadge({ role }) { const config = ALL_ROLES.find((item) => item.id === role); return <span className={`admin-tag admin-tag--${config?.tone || 'info'}`}>{config?.label || role}</span>; }
function InfoRow({ icon: Icon, label, value }) { return <div className="admin-vendor-info-row"><span className="admin-vendor-info-row__icon"><Icon size={14} /></span><div className="admin-vendor-info-row__text"><span className="admin-vendor-info-row__label">{label}</span><span className="admin-vendor-info-row__value">{value || '—'}</span></div></div>; }

function RoleAssignmentModal({ user, roles, onSave, onCancel, saving }) {
  const [selected, setSelected] = useState(roles);
  const toggle = (role) => setSelected((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  if (!user) return null;
  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onCancel} /><div className="admin-modal__card admin-modal__card--lg"><header className="admin-modal__head"><div className="admin-modal__icon admin-modal__icon--success"><IconShield size={20} /></div><div><h3 className="admin-modal__title">Manage roles</h3><p className="admin-modal__sub">{user.full_name || user.email}</p></div></header><p className="admin-modal__copy">Select the roles this user should retain. Changes are applied immediately.</p><ul className="admin-role-list">{ALL_ROLES.map((role) => <li key={role.id} className="admin-role-list__item"><input type="checkbox" id={`role-${role.id}`} checked={selected.includes(role.id)} onChange={() => toggle(role.id)} className="admin-role-list__checkbox" /><label htmlFor={`role-${role.id}`} className="admin-role-list__label"><span className={`admin-tag admin-tag--${role.tone}`}>{role.label}</span><span className="admin-role-list__hint">{ROLE_HINTS[role.id] || 'Platform access role.'}</span></label></li>)}</ul><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onCancel}>Cancel</button><button type="button" className="admin-action admin-action--approve" onClick={() => onSave(selected)} disabled={saving}><IconCheck size={13} /> {saving ? 'Saving…' : 'Save role changes'}</button></footer></div></div>;
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const { session } = useAuth();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!session?.access_token || !userId) return;
    setLoading(true); setError('');
    try { const response = await getUserRoles(session.access_token, userId); setUser(response.user); setRoles(response.roles || []); } catch (err) { setError(err.message || 'Could not load user.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [session?.access_token, userId]);
  const saveRoles = async (nextRoles) => { setSaving(true); try { const response = await setUserRoles(session.access_token, userId, nextRoles); setRoles(response.roles || nextRoles); setAssigning(false); } catch (err) { setError(err.message || 'Could not update roles.'); } finally { setSaving(false); } };

  if (loading) return <div className="admin-vendor-detail__loading"><div className="admin-vendor-detail__loading-spinner" /><p>Loading user...</p></div>;
  if (!user || error) return <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>User not found</h3><p>{error || 'The user profile may have been archived.'}</p><Link to="/admin/users" className="admin-action--ghost"><IconChevronLeft size={13} /> Back to users</Link></div>;

  return <div className="admin-user-detail-wrapper"><Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Users', to: '/admin/users' }, { label: user.full_name || user.email }]} /><section className="admin-user-hero"><div className="admin-user-hero__avatar"><Avatar name={user.full_name || user.email} /></div><div className="admin-user-hero__info"><div className="admin-user-hero__head"><span className="admin-user-hero__slug">{user.employee_number || 'No employee number'}</span><span className="admin-status admin-status--success">Profile loaded</span></div><h2 className="admin-user-hero__name">{user.full_name || 'Unnamed user'}</h2><span className="admin-user-hero__email">{user.email}</span><div className="admin-user-hero__roles">{roles.length ? roles.map((role) => <RoleBadge key={role} role={role} />) : <span className="admin-tag">No roles</span>}</div></div><div className="admin-order-hero__actions"><button type="button" className="admin-action--ghost" onClick={() => setAssigning(true)}><IconShield size={14} /> Manage roles</button></div></section><div className="admin-user-detail-grid"><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Identity</span><h3 className="admin-card__title">Account details</h3></div></header><div className="admin-user-detail-sections"><div className="admin-vendor-section"><InfoRow icon={IconUser} label="Name" value={user.full_name} /><InfoRow icon={IconMail} label="Email" value={user.email} /><InfoRow icon={IconInfoCircle} label="Employee number" value={user.employee_number} /></div></div></section><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Access</span><h3 className="admin-card__title">Assigned roles</h3></div><button type="button" className="admin-action--ghost" onClick={() => setAssigning(true)}>Edit roles</button></header><div className="admin-user-detail-sections">{roles.length ? roles.map((role) => <div className="vendor-managed-row" key={role}><RoleBadge role={role} /><span>{ROLE_HINTS[role] || 'Platform access role.'}</span></div>) : <p className="admin-vendor-empty-copy">No roles assigned.</p>}</div></section></div><RoleAssignmentModal user={assigning ? user : null} roles={roles} onSave={saveRoles} onCancel={() => setAssigning(false)} saving={saving} /></div>;
}
