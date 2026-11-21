export default function ProfileHeader({ profile, user }) {
  const name = profile?.full_name || 'Your profile';
  const isMissingFields = [
    profile?.full_name,
    profile?.employee_number,
    profile?.email || user?.email,
    profile?.department,
    profile?.business_unit,
    profile?.cost_centre,
    profile?.preferred_site_id,
    profile?.preferred_building_id,
  ].some((value) => !value);

  return (
    <section className="profile_intro" aria-label="Profile summary">
      <div className="profile_hero-copy">
        <p className="profile_eyebrow">Account overview</p>
        <h1 className="profile_hero-name">{name}</h1>
      </div>
      <div className="profile_hero-meta">
        <span className={`profile_status-pill${profile?.is_active === false ? ' profile_status-pill--inactive' : ''}`}>
          <span className="profile_status-dot" />
          {profile?.is_active === false ? 'Inactive' : 'Active'}
        </span>
        {isMissingFields && (
          <span className="profile_hero-number">Some details are missing from your profile.</span>
        )}
      </div>
    </section>
  );
}
