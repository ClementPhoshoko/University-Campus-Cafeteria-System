import { useMemo, useState } from 'react';
import {
  IconSettings,
  IconCash,
  IconBan,
  IconFlag,
  IconBell,
  IconTools,
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconPower,
  IconChevronRight,
  IconUserCheck,
  IconCalendar,
  IconClock,
  IconCircleCheck,
  IconAlertTriangle,
  IconBuilding,
  IconAlertCircle,
  IconHistory,
  IconDownload,
  IconAdjustments,
  IconRefresh,
  IconBriefcase,
  IconBolt,
  IconGift,
  IconStar,
  IconReceipt,
} from '@tabler/icons-react';
import {
  SETTINGS_TABS,
  PLATFORM_SETTINGS,
  FEE_RULES,
  TAX_RATES,
  CANCELLATION_RULES,
  FEATURE_FLAGS,
  NOTIFICATION_TEMPLATES,
  MAINTENANCE_WINDOWS,
  SETTINGS_ACTIVITY,
} from './adminMockData.js';

const ICON_MAP = {
  IconSettings,
  IconCash,
  IconBan,
  IconFlag,
  IconBell,
  IconTools,
};

const FLAG_ICON_MAP = {
  IconBriefcase,
  IconBolt,
  IconGift,
  IconCalendar,
  IconStar,
  IconReceipt,
};

const CHANNEL_LABEL = { in_app: 'In-app', push: 'Push', email: 'Email' };

function StatTile({ label, value, sub, tone, icon: Icon }) {
  return (
    <div className={`admin-kpi admin-kpi--${tone || 'blue'}`}>
      <span className="admin-kpi__label">
        {Icon && <Icon size={14} stroke={1.8} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />}
        {label}
      </span>
      <span className="admin-kpi__value">{value}</span>
      {sub && <span className="admin-kpi__sub">{sub}</span>}
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub, actions }) {
  return (
    <header className="admin-card__head admin-card__head--inline">
      <div>
        <span className="admin-card__eyebrow">{eyebrow}</span>
        <h3 className="admin-card__title">{title}</h3>
        {sub && <p className="admin-report-section__sub">{sub}</p>}
      </div>
      {actions}
    </header>
  );
}

function KvRow({ setting, onEdit }) {
  const isBool = typeof setting.value === 'boolean';
  return (
    <div className="admin-kv-row">
      <div className="admin-kv-row__id">
        <span className="admin-kv-row__key">{setting.key}</span>
        {setting.is_sensitive && (
          <span className="admin-tag admin-tag--blue">Sensitive</span>
        )}
        <span className="admin-kv-row__desc">{setting.description}</span>
      </div>
      <div className="admin-kv-row__value">
        {isBool ? (
          <span className={`admin-status ${setting.value ? 'admin-status--success' : 'admin-status--info'}`}>
            {setting.value ? 'Enabled' : 'Disabled'}
          </span>
        ) : (
          <span className="admin-kv-row__value-text">{String(setting.value)}</span>
        )}
        <button type="button" className="admin-link-cta" onClick={() => onEdit(setting)}>
          Edit <IconChevronRight size={12} stroke={2} />
        </button>
      </div>
    </div>
  );
}

function PlatformValueModal({ setting, onClose, onSave }) {
  if (!setting) return null;
  const isBool = typeof setting.value === 'boolean';
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconSettings size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Edit platform setting</h3>
            <p className="admin-modal__sub">{setting.key}</p>
          </div>
        </header>

        <p className="admin-modal__copy">{setting.description}</p>

        <label className="admin-modal__field">
          <span>Value</span>
          {isBool ? (
            <select className="admin-input" defaultValue={setting.value ? 'true' : 'false'}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          ) : (
            <input
              type={typeof setting.value === 'number' ? 'number' : 'text'}
              className="admin-input"
              defaultValue={String(setting.value)}
            />
          )}
        </label>

        <label className="admin-modal__field">
          <span>Change note (audit log)</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="Why is this changing? Who approved?"
            rows={3}
          />
        </label>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onSave}>
            <IconCircleCheck size={13} stroke={2} /> Save change
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ── Tab 1: General ── */

function GeneralSection() {
  const [editing, setEditing] = useState(null);
  return (
    <div className="admin-report-stack">
      <section className="admin-kpis" aria-label="General summary">
        <StatTile label="Settings" value={PLATFORM_SETTINGS.length} sub="tracked platform keys" tone="blue" icon={IconSettings} />
        <StatTile label="Sensitive" value={PLATFORM_SETTINGS.filter((s) => s.is_sensitive).length} sub="masked in API logs" tone="amber" icon={IconUserCheck} />
        <StatTile label="Last edited" value="Today · 10:14" sub="by Nomvula Dube" tone="green" icon={IconClock} />
        <StatTile label="Active site" value="Main campus" sub="Merchant Place · Main" tone="blue" icon={IconBuilding} />
      </section>

      <section className="admin-card admin-card--full">
        <SectionHeader
          eyebrow="platform_settings table"
          title="General platform settings"
          sub="Key/value configuration used across the ordering flow. Sensitive values are masked in API logs."
          actions={
            <button type="button" className="admin-action admin-action--approve">
              <IconPlus size={13} stroke={2} /> New setting
            </button>
          }
        />
        <div className="admin-kv-list">
          {PLATFORM_SETTINGS.map((s) => (
            <KvRow key={s.key} setting={s} onEdit={setEditing} />
          ))}
        </div>
      </section>

      <PlatformValueModal
        setting={editing}
        onClose={() => setEditing(null)}
        onSave={() => setEditing(null)}
      />
    </div>
  );
}

/* ── Tab 2: Fees & Tax ── */

const FEE_TYPE_LABEL = {
  service_fee: 'Service fee',
  delivery_fee: 'Delivery fee',
  processing_fee: 'Processing fee',
};

function FeeRowActions({ rule, onEdit }) {
  return (
    <button type="button" className="admin-action" onClick={() => onEdit(rule)}>
      <IconEdit size={13} stroke={2} />
      Edit
    </button>
  );
}

function FeeRuleModal({ rule, onClose, onSave }) {
  if (!rule) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card admin-modal__card--lg">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconCash size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Edit fee rule</h3>
            <p className="admin-modal__sub">{rule.name} · {rule.scope}</p>
          </div>
        </header>

        <div className="admin-form-grid">
          <label className="admin-modal__field">
            <span>Name</span>
            <input type="text" className="admin-input" defaultValue={rule.name} />
          </label>
          <label className="admin-modal__field">
            <span>Fee type</span>
            <select className="admin-input" defaultValue={rule.fee_type}>
              <option value="service_fee">Service fee</option>
              <option value="delivery_fee">Delivery fee</option>
              <option value="processing_fee">Processing fee</option>
            </select>
          </label>
          <label className="admin-modal__field">
            <span>Calculation</span>
            <select className="admin-input" defaultValue={rule.calculationType}>
              <option value="percentage">Percentage of subtotal</option>
              <option value="fixed">Fixed amount (ZAR)</option>
            </select>
          </label>
          <label className="admin-modal__field">
            <span>Amount</span>
            <input
              type="text"
              className="admin-input"
              defaultValue={rule.calculationType === 'percentage' ? `${rule.amount}%` : `R ${rule.amount.toFixed(2)}`}
            />
          </label>
          <label className="admin-modal__field">
            <span>Active from</span>
            <input type="text" className="admin-input" defaultValue={rule.activeFrom} />
          </label>
          <label className="admin-modal__field">
            <span>Active until</span>
            <input type="text" className="admin-input" defaultValue={rule.activeUntil || 'Until revoked'} />
          </label>
        </div>

        <label className="admin-modal__field">
          <span>Internal note</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="Why is this rule being changed?"
            rows={3}
            defaultValue={rule.description}
          />
        </label>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onSave}>
            <IconCircleCheck size={13} stroke={2} /> Save rule
          </button>
        </footer>
      </div>
    </div>
  );
}

function FeesSection() {
  const [editing, setEditing] = useState(null);
  const activeFees = FEE_RULES.filter((f) => f.is_active).length;

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Active fee rules" value={activeFees} sub={`${FEE_RULES.length - activeFees} deprecated`} tone="blue" icon={IconCash} />
        <StatTile label="Service fee" value="5%" sub="Platform-wide default" tone="green" icon={IconCash} />
        <StatTile label="Processing fee" value="2%" sub="Provider-level" tone="blue" icon={IconCash} />
        <StatTile label="Tax rates" value={TAX_RATES.length} sub="all active" tone="amber" icon={IconReceipt} />
      </section>

      <section className="admin-card">
        <SectionHeader
          eyebrow="fee_rules table"
          title="Fee rules"
          sub="Lower priority numbers take precedence. Site / vendor overrides beat platform defaults."
          actions={
            <button type="button" className="admin-action admin-action--approve">
              <IconPlus size={13} stroke={2} /> New rule
            </button>
          }
        />
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Fee type</th>
              <th>Scope</th>
              <th>Calculation</th>
              <th>Amount</th>
              <th>Priority</th>
              <th>Valid</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {FEE_RULES.map((r) => (
              <tr key={r.id} className="admin-order-row">
                <td>
                  <div className="admin-fee-row__name">
                    <strong>{r.name}</strong>
                    <small>{r.description}</small>
                  </div>
                </td>
                <td>{FEE_TYPE_LABEL[r.fee_type]}</td>
                <td>
                  <span className="admin-tag">{r.scope}</span>
                  {r.site_id && (
                    <span className="admin-tag admin-tag--blue">{r.site_id}</span>
                  )}
                </td>
                <td className="admin-vendor-name">{r.calculation_type === 'fixed' ? 'Fixed amount' : 'Percentage'}</td>
                <td><strong>{r.display_amount}</strong></td>
                <td><span className="admin-kpi__sub">{r.priority}</span></td>
                <td>
                  <span>{r.active_from}</span>
                  {r.active_until && (
                    <>
                      <br />
                      <small className="admin-cmp-time">→ {r.active_until}</small>
                    </>
                  )}
                </td>
                <td>
                  <span className={`admin-status admin-status--${r.is_active ? 'success' : 'info'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="admin-order-cta">
                  <FeeRowActions rule={r} onEdit={setEditing} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <SectionHeader
          eyebrow="tax_rates table"
          title="Tax rates · per campus"
          sub="All tax rates are VAT percentages applied after discounts."
          actions={
            <button type="button" className="admin-action admin-action--approve">
              <IconPlus size={13} stroke={2} /> New rate
            </button>
          }
        />
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Campus</th>
              <th>Rate</th>
              <th>Active from</th>
              <th>Active until</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {TAX_RATES.map((t) => (
              <tr key={t.id} className="admin-order-row">
                <td className="admin-vendor-name">{t.name}</td>
                <td>{t.siteLabel}</td>
                <td><strong>{t.displayRate}</strong></td>
                <td>{t.activeFrom}</td>
                <td>{t.activeUntil || <span className="admin-tag admin-tag--success">Ongoing</span>}</td>
                <td>
                  <span className={`admin-status admin-status--${t.is_active ? 'success' : 'info'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <FeeRuleModal rule={editing} onClose={() => setEditing(null)} onSave={() => setEditing(null)} />
    </div>
  );
}

/* ── Tab 3: Cancellations ── */

function CancellationModal({ rule, onClose, onSave }) {
  if (!rule) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconBan size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Edit cancellation rule</h3>
            <p className="admin-modal__sub">{rule.vendorLocation}</p>
          </div>
        </header>

        <div className="admin-form-grid">
          <label className="admin-modal__field">
            <span>Cutoff minutes</span>
            <input type="number" className="admin-input" defaultValue={rule.cutoffMinutes} />
          </label>
          <label className="admin-modal__field">
            <span>Default refund %</span>
            <input type="number" className="admin-input" defaultValue={rule.defaultRefundPercent} />
          </label>
        </div>

        <div className="admin-modal__check">
          <input type="checkbox" id="allow-after-payment" defaultChecked={rule.allowAfterPayment} />
          <label htmlFor="allow-after-payment">Allow cancellation after payment</label>
        </div>
        <div className="admin-modal__check">
          <input type="checkbox" id="admin-override" defaultChecked={rule.adminOverrideAllowed} />
          <label htmlFor="admin-override">Allow admin override</label>
        </div>

        <label className="admin-modal__field">
          <span>Internal note</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="Why is this rule being changed?"
            rows={3}
            defaultValue={rule.note}
          />
        </label>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onSave}>
            <IconCircleCheck size={13} stroke={2} /> Save rule
          </button>
        </footer>
      </div>
    </div>
  );
}

function CancellationsSection() {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query) return CANCELLATION_RULES;
    const q = query.toLowerCase();
    return CANCELLATION_RULES.filter((r) =>
      `${r.vendorLocation} ${r.note}`.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Rules" value={CANCELLATION_RULES.length} sub="vendor locations" tone="blue" icon={IconBan} />
        <StatTile label="Average cutoff" value="15 min" sub="across vendors" tone="blue" icon={IconClock} />
        <StatTile label="Allow after payment" value={`${CANCELLATION_RULES.filter((r) => r.allowAfterPayment).length} / ${CANCELLATION_RULES.length}`} sub="on request" tone="green" icon={IconCircleCheck} />
        <StatTile label="Admin override" value={`${CANCELLATION_RULES.filter((r) => r.adminOverrideAllowed).length} / ${CANCELLATION_RULES.length}`} sub="editable by super admins" tone="amber" icon={IconUserCheck} />
      </section>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} stroke={1.8} />
          <input
            type="search"
            placeholder="Search vendor or rule notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search cancellations"
          />
        </div>
      </div>

      <div className="admin-settings-grid">
        {filtered.map((r) => (
          <article key={r.id} className="admin-cancel-card">
            <header className="admin-cancel-card__head">
              <span className="admin-cancel-card__icon">
                <IconBan size={16} stroke={1.8} />
              </span>
              <div className="admin-cancel-card__heading">
                <h4 className="admin-cancel-card__name">{r.vendorLocation}</h4>
                <span className="admin-cancel-card__meta">
                  Edited by {r.lastEditedBy} · {r.lastEditedAt}
                </span>
              </div>
              <span className={`admin-status admin-status--${r.is_active ? 'success' : 'info'}`}>
                {r.is_active ? 'Active' : 'Inactive'}
              </span>
            </header>

            <div className="admin-cancel-card__stats">
              <div className="admin-cancel-card__stat">
                <span className="admin-cancel-card__stat-num">{r.cutoffMinutes}</span>
                <span className="admin-cancel-card__stat-label">min cutoff</span>
              </div>
              <div className="admin-cancel-card__stat">
                <span className="admin-cancel-card__stat-num">{r.defaultRefundPercent}%</span>
                <span className="admin-cancel-card__stat-label">refund</span>
              </div>
              <div className="admin-cancel-card__stat">
                <span className="admin-cancel-card__stat-num">{r.allowAfterPayment ? 'Yes' : 'No'}</span>
                <span className="admin-cancel-card__stat-label">post-pay</span>
              </div>
              <div className="admin-cancel-card__stat">
                <span className="admin-cancel-card__stat-num">{r.adminOverrideAllowed ? 'Yes' : 'No'}</span>
                <span className="admin-cancel-card__stat-label">admin override</span>
              </div>
            </div>

            <p className="admin-cancel-card__note">{r.note}</p>

            <button type="button" className="admin-action" onClick={() => setEditing(r)}>
              <IconEdit size={13} stroke={2} /> Edit rule
            </button>
          </article>
        ))}
      </div>

      <CancellationModal rule={editing} onClose={() => setEditing(null)} onSave={() => setEditing(null)} />
    </div>
  );
}

/* ── Tab 4: Feature flags ── */

function FlagCard({ flag, onToggle }) {
  const FlagIcon = FLAG_ICON_MAP[flag.icon] || IconFlag;
  return (
    <article className={`admin-flag-card admin-flag-card--${flag.tone}`}>
      <header className="admin-flag-card__head">
        <span className="admin-flag-card__icon">
          <FlagIcon size={18} stroke={1.8} />
        </span>
        <div className="admin-flag-card__heading">
          <h4 className="admin-flag-card__name">{flag.name}</h4>
          <span className="admin-flag-card__scope">
            <IconBuilding size={11} stroke={1.8} /> {flag.scope} · {flag.scopeDetail}
          </span>
        </div>
        <span className={`admin-flag-card__toggle ${flag.enabled ? 'is-on' : ''}`}>
          <span className="admin-flag-card__knob" />
        </span>
      </header>

      <p className="admin-flag-card__desc">{flag.description}</p>

      <div className="admin-flag-card__rollout">
        <span className="admin-flag-card__rollout-label">Rollout</span>
        <div className="admin-flag-card__bar">
          <span
            className="admin-flag-card__bar-fill"
            style={{ width: `${flag.enabled ? flag.rolloutPercent : 0}%` }}
          />
        </div>
        <span className="admin-flag-card__rollout-num">{flag.enabled ? flag.rolloutPercent : 0}%</span>
      </div>

      <footer className="admin-flag-card__foot">
        <span className="admin-flag-card__meta">
          Toggled by {flag.lastToggledBy} · {flag.lastToggledAt}
        </span>
        <button
          type="button"
          className={`admin-action ${flag.enabled ? 'admin-action--reject' : 'admin-action--approve'}`}
          onClick={() => onToggle(flag)}
        >
          <IconPower size={13} stroke={2} />
          {flag.enabled ? 'Disable' : 'Enable'}
        </button>
      </footer>
    </article>
  );
}

function FeaturesSection() {
  const [flags, setFlags] = useState(FEATURE_FLAGS);

  const toggle = (flag) => {
    setFlags((items) => items.map((i) => i.key === flag.key ? { ...i, enabled: !i.enabled } : i));
  };

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Enabled" value={enabledCount} sub={`${flags.length - enabledCount} disabled`} tone="green" icon={IconFlag} />
        <StatTile label="Platform-wide" value={flags.filter((f) => f.scope === 'Platform').length} sub="global rollouts" tone="blue" icon={IconAdjustments} />
        <StatTile label="Site-scoped" value={flags.filter((f) => f.scope === 'Site').length} sub="per-campus flags" tone="amber" icon={IconBuilding} />
        <StatTile label="Scheduled launches" value={flags.filter((f) => !f.enabled && f.rolloutPercent > 0).length} sub="staged rollouts" tone="info" icon={IconCalendar} />
      </section>

      <div className="admin-flag-grid">
        {flags.map((flag) => (
          <FlagCard key={flag.key} flag={flag} onToggle={toggle} />
        ))}
      </div>
    </div>
  );
}

/* ── Tab 5: Notification templates ── */

function TemplateRow({ template, onEdit }) {
  return (
    <tr className="admin-order-row">
      <td>
        <div className="admin-tpl-row__name">
          <strong>{template.name}</strong>
          <small>{template.description}</small>
        </div>
      </td>
      <td>
          <span className="admin-kpi__sub">{template.event_key}</span>
      </td>
      <td>
        <div className="admin-tpl-preview">
          <span className="admin-tpl-preview__title">{template.title_template}</span>
          <span className="admin-tpl-preview__body">{template.body_template}</span>
        </div>
      </td>
      <td>
        <span className="admin-ann-channel-chips">
          {template.enabled_channels.map((c) => (
            <span key={c} className="admin-tag admin-tag--blue">{CHANNEL_LABEL[c]}</span>
          ))}
        </span>
      </td>
      <td>
        <span className={`admin-status admin-status--${template.is_active ? 'success' : 'info'}`}>
          {template.is_active ? 'Active' : 'Paused'}
        </span>
      </td>
      <td className="admin-order-cta">
        <button type="button" className="admin-action" onClick={() => onEdit(template)}>
          <IconEdit size={13} stroke={2} /> Edit
        </button>
      </td>
    </tr>
  );
}

function TemplateModal({ template, onClose, onSave }) {
  if (!template) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card admin-modal__card--lg">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconBell size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Edit notification template</h3>
            <p className="admin-modal__sub">{template.name} · {template.event_key}</p>
          </div>
        </header>

        <p className="admin-modal__copy">{template.description}</p>

        <label className="admin-modal__field">
          <span>Title template</span>
          <input type="text" className="admin-input" defaultValue={template.title_template} />
        </label>

        <label className="admin-modal__field">
          <span>Body template</span>
          <textarea
            className="admin-modal__textarea"
            defaultValue={template.body_template}
            rows={4}
          />
        </label>

        <div className="admin-form-grid">
          <label className="admin-modal__check">
            <input type="checkbox" defaultChecked={template.enabled_channels.includes('in_app')} />
            <span>In-app banner</span>
          </label>
          <label className="admin-modal__check">
            <input type="checkbox" defaultChecked={template.enabled_channels.includes('push')} />
            <span>Push notification</span>
          </label>
          <label className="admin-modal__check">
            <input type="checkbox" defaultChecked={template.enabled_channels.includes('email')} />
            <span>Email</span>
          </label>
        </div>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onSave}>
            <IconCircleCheck size={13} stroke={2} /> Save template
          </button>
        </footer>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [editing, setEditing] = useState(null);
  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Templates" value={NOTIFICATION_TEMPLATES.length} sub="all event triggers" tone="blue" icon={IconBell} />
        <StatTile label="Active channels" value="3" sub="In-app · Push · Email" tone="green" icon={IconRefresh} />
        <StatTile label="Last edited" value="2 days ago" sub="by Nomvula Dube" tone="blue" icon={IconHistory} />
        <StatTile label="Open rate · 30d" value="76%" sub="across channels" tone="amber" icon={IconCircleCheck} />
      </section>

      <section className="admin-card admin-card--full">
        <SectionHeader
          eyebrow="notification_templates table"
          title="System notification templates"
          sub="Messages triggered by order lifecycle events. Variables in {'{curly}'} braces resolve per-recipient."
          actions={
            <button type="button" className="admin-action admin-action--approve">
              <IconPlus size={13} stroke={2} /> New template
            </button>
          }
        />
        <table className="admin-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Key</th>
              <th>Preview</th>
              <th>Channels</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_TEMPLATES.map((t) => (
              <TemplateRow key={t.key} template={t} onEdit={setEditing} />
            ))}
          </tbody>
        </table>
      </section>

      <TemplateModal template={editing} onClose={() => setEditing(null)} onSave={() => setEditing(null)} />
    </div>
  );
}

/* ── Tab 6: Maintenance ── */

function MaintenanceCard({ window }) {
  const isHistory = window.status === 'history';
  return (
    <article className={`admin-mw-card ${isHistory ? 'admin-mw-card--history' : 'admin-mw-card--scheduled'}`}>
      <header className="admin-mw-card__head">
        <span className={`admin-mw-card__icon ${isHistory ? 'admin-mw-card__icon--history' : 'admin-mw-card__icon--scheduled'}`}>
          {isHistory ? <IconHistory size={18} stroke={1.8} /> : <IconAlertCircle size={18} stroke={1.8} />}
        </span>
        <div className="admin-mw-card__heading">
          <h4 className="admin-mw-card__name">{window.title}</h4>
          <span className="admin-mw-card__meta">
            Created by {window.createdBy} · {window.createdAt}
          </span>
        </div>
        <span className={`admin-status admin-status--${isHistory ? 'info' : 'warning'}`}>
          {isHistory ? 'History' : 'Scheduled'}
        </span>
      </header>

      <p className="admin-mw-card__copy">{window.message}</p>

      <div className="admin-mw-card__schedule">
        <div>
          <span className="admin-mw-card__sched-label">Starts</span>
          <span className="admin-mw-card__sched-value">{window.startsAt}</span>
        </div>
        <div>
          <span className="admin-mw-card__sched-label">Ends</span>
          <span className="admin-mw-card__sched-value">{window.endsAt}</span>
        </div>
      </div>

      <div className="admin-mw-card__foot">
        <span className="admin-mw-card__foot-meta">
          <IconClock size={12} stroke={1.8} />
          {isHistory ? 'Completed · audit-logged' : 'Banner activates automatically'}
        </span>
        {!isHistory && (
          <div className="admin-mw-card__foot-actions">
            <button type="button" className="admin-action">
              <IconEdit size={13} stroke={2} /> Edit
            </button>
            <button type="button" className="admin-action admin-action--reject">
              <IconBan size={13} stroke={2} /> Cancel
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function MaintenanceSection() {
  const scheduled = MAINTENANCE_WINDOWS.filter((w) => w.status === 'scheduled');
  const history = MAINTENANCE_WINDOWS.filter((w) => w.status === 'history');

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Scheduled" value={scheduled.length} sub="upcoming windows" tone="amber" icon={IconAlertCircle} />
        <StatTile label="History" value={history.length} sub="last 30 days" tone="blue" icon={IconHistory} />
        <StatTile label="Auto-banner" value="On" sub="pulls from main slice of window" tone="green" icon={IconBell} />
        <StatTile label="Platform uptime · 90d" value="99.94%" sub="measured across sites" tone="green" icon={IconCircleCheck} />
      </section>

      <section className="admin-card">
        <SectionHeader
          eyebrow="maintenance_windows · scheduled"
          title="Upcoming maintenance"
          actions={
            <button type="button" className="admin-action admin-action--approve">
              <IconPlus size={13} stroke={2} /> Schedule window
            </button>
          }
        />
        <div className="admin-mw-grid">
          {scheduled.map((w) => (
            <MaintenanceCard key={w.id} window={w} />
          ))}
        </div>
      </section>

      <section className="admin-card">
        <SectionHeader eyebrow="history" title="Past maintenance windows" />
        <div className="admin-mw-grid">
          {history.map((w) => (
            <MaintenanceCard key={w.id} window={w} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Side panel: audit ── */

function SettingsAuditPanel() {
  return (
    <section className="admin-card">
      <header className="admin-card__head">
        <div>
          <span className="admin-card__eyebrow">Compliance</span>
          <h3 className="admin-card__title">Recent admin changes</h3>
        </div>
        <span className="admin-card__chip">
          <IconHistory size={13} stroke={2} /> Auto-tracked
        </span>
      </header>
      <ul className="admin-activity-list">
        {SETTINGS_ACTIVITY.map((entry) => (
          <li key={entry.id} className={`admin-activity admin-activity--${entry.tone}`}>
            <span className="admin-activity__dot" aria-hidden="true" />
            <div className="admin-activity__body">
              <span className="admin-activity__line">
                <strong>{entry.actor}</strong> {entry.action}
              </span>
              <span className="admin-activity__time">{entry.at}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Main orchestrator ── */

export default function AdminSettingsPage() {
  const [tab, setTab] = useState('general');
  const current = SETTINGS_TABS.find((t) => t.id === tab);

  const renderSection = () => {
    switch (tab) {
      case 'general': return <GeneralSection />;
      case 'fees': return <FeesSection />;
      case 'cancellations': return <CancellationsSection />;
      case 'features': return <FeaturesSection />;
      case 'notifications': return <NotificationsSection />;
      case 'maintenance': return <MaintenanceSection />;
      default: return <GeneralSection />;
    }
  };

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Configuration</span>
          <p className="admin-vendors__sub">
            Configure fees, taxes, cancellation rules, feature rollouts, notification templates and scheduled maintenance windows. All changes are audit-logged.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconDownload size={13} stroke={2} />
            Export config
          </button>
          <button type="button" className="admin-action">
            <IconHistory size={13} stroke={2} />
            Audit log
          </button>
        </div>
      </header>

      <div className="admin-vendors__tabs" role="tablist">
        {SETTINGS_TABS.map((t) => {
          const Icon = ICON_MAP[t.icon] || IconSettings;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`admin-vendors__tab${tab === t.id ? ' admin-vendors__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={16} stroke={1.8} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="admin-reports__controls">
        <div className="admin-reports__filter-label">
          <IconAdjustments size={14} stroke={1.8} />
          Section
        </div>
        <div className="admin-reports__active-name">
          <IconSettings size={14} stroke={1.8} />
          {current?.label}
        </div>
      </div>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">{renderSection()}</div>
        <div className="admin-order-grid__side">
          <SettingsAuditPanel />
        </div>
      </div>
    </div>
  );
}
