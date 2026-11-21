import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { IconBuilding, IconMapPin } from '@tabler/icons-react';
import { useFetch } from '../../../hooks/useFetch.js';
import { listSiteBuildings, listSites } from '../../../services/locationApi.js';
import { ProfileField } from '../components/ProfileField.jsx';
import ProfileSaveActions from '../components/ProfileSaveActions.jsx';
import ProfileFormMessage from '../components/ProfileFormMessage.jsx';
import LocationSelect from '../components/LocationSelect.jsx';
import { buildFullNamePatch, buildLocationPatch, hasMorePages } from '../profileForms.js';

const LOCATION_PAGE_SIZE = 20;

function ProfileAttributeCard({ title, rows }) {
  return (
    <div className="profile_card">
      <div className="profile_card-header">
        <div className="profile_card-heading">
          <IconBuilding size={18} stroke={1.8} />
          <h3 className="profile_card-title">{title}</h3>
        </div>
      </div>
      <dl className="profile_info-list">
        {rows.map(({ label, value }) => (
          <ProfileField key={label} label={label} value={value} />
        ))}
      </dl>
    </div>
  );
}

export default function ProfileOverviewPage() {
  const { profile, token, saveProfile } = useOutletContext();
  const [editing, setEditing] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [draft, setDraft] = useState({ full_name: profile?.full_name || '' });
  const [locationDraft, setLocationDraft] = useState({
    preferred_site_id: profile?.preferred_site_id || '',
    preferred_building_id: profile?.preferred_building_id || '',
  });
  const [locationLabels, setLocationLabels] = useState({ site: '', building: '' });
  const [sitePage, setSitePage] = useState(1);
  const [buildingPage, setBuildingPage] = useState(1);
  const [savingName, setSavingName] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locationSuccess, setLocationSuccess] = useState('');

  useEffect(() => {
    setDraft({ full_name: profile?.full_name || '' });
    setLocationDraft({
      preferred_site_id: profile?.preferred_site_id || '',
      preferred_building_id: profile?.preferred_building_id || '',
    });
    setSitePage(1);
    setBuildingPage(1);
  }, [profile]);

  const fetchSites = useCallback(
    ({ signal }) => listSites({ token, page: sitePage, limit: LOCATION_PAGE_SIZE, signal }),
    [token, sitePage],
  );
  const sitesQuery = useFetch(fetchSites, { enabled: !!token });

  useEffect(() => {
    setBuildingPage(1);
  }, [locationDraft.preferred_site_id]);

  const fetchBuildings = useCallback(
    ({ signal }) => (
      locationDraft.preferred_site_id
        ? listSiteBuildings(locationDraft.preferred_site_id, {
          token,
          page: buildingPage,
          limit: LOCATION_PAGE_SIZE,
          signal,
        })
        : Promise.resolve({ success: true, buildings: [], pagination: { page: 1, totalPages: 1 } })
    ),
    [token, locationDraft.preferred_site_id, buildingPage],
  );
  const buildingsQuery = useFetch(fetchBuildings, {
    enabled: !!token && !!locationDraft.preferred_site_id,
  });

  const siteOptions = (sitesQuery.data?.sites || []).map((site) => ({ id: site.id, name: site.name }));
  const buildingsForSite = buildingsQuery.data?.site_id === locationDraft.preferred_site_id
    ? buildingsQuery.data
    : null;
  const buildingOptions = (buildingsForSite?.buildings || []).map((building) => ({
    id: building.id,
    name: building.name,
  }));

  const siteLabel = siteOptions.find((site) => site.id === profile?.preferred_site_id)?.name
    || (profile?.preferred_site_id === locationDraft.preferred_site_id ? locationLabels.site : '')
    || (profile?.preferred_site_id ? 'Selected site' : 'Not set');
  const buildingLabel = buildingOptions.find((building) => building.id === profile?.preferred_building_id)?.name
    || (profile?.preferred_building_id === locationDraft.preferred_building_id ? locationLabels.building : '')
    || (profile?.preferred_building_id ? 'Selected building' : 'Not set');

  const save = async () => {
    const built = buildFullNamePatch(draft.full_name);
    if (built.error) {
      setNameError(built.error);
      return;
    }

    setNameError('');
    setNameSuccess('');
    setSavingName(true);
    try {
      await saveProfile(built.patch);
      setEditing(false);
      setNameSuccess('Your name has been updated.');
    } catch (err) {
      setNameError(err?.message || 'Could not save your name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const saveLocation = async () => {
    const { patch } = buildLocationPatch({
      siteId: locationDraft.preferred_site_id,
      buildingId: locationDraft.preferred_building_id,
    });
    setLocationError('');
    setLocationSuccess('');
    setSavingLocation(true);
    try {
      await saveProfile(patch);
      setEditingLocation(false);
      setLocationSuccess('Your ordering location has been updated.');
    } catch (err) {
      setLocationError(err?.message || 'Could not save your location. Please try again.');
    } finally {
      setSavingLocation(false);
    }
  };

  const workplaceRows = [
    { label: 'Department', value: profile?.department },
    { label: 'Business unit', value: profile?.business_unit },
    { label: 'Cost centre', value: profile?.cost_centre },
  ];

  return (
    <section className="profile_section">
      <div className="profile_editable-group">
        <div className="profile_section-toolbar">
          <div className="profile_section-label">Personal and workplace information</div>
        </div>
        <ProfileFormMessage error={nameError} success={nameSuccess} />
        <ProfileAttributeCard title="Workplace information" rows={workplaceRows} />
        <dl className="profile_info-list profile_info-list--personal">
          <div className="profile_info-row">
            <dt className="profile_info-label">
              <span className="profile_info-label-with-action">
                <span>Full name</span>
                <ProfileSaveActions
                  editing={editing}
                  onEdit={() => { setNameError(''); setNameSuccess(''); setEditing(true); }}
                  onCancel={() => setEditing(false)}
                  onSave={save}
                  saving={savingName}
                />
              </span>
            </dt>
            <dd className="profile_info-value">
              {editing ? (
                <input
                  className="profile_inline-input"
                  aria-label="Full name"
                  value={draft.full_name}
                  disabled={savingName}
                  onChange={(event) => setDraft({ ...draft, full_name: event.target.value })}
                />
              ) : (
                <span>{profile?.full_name || 'Not set'}</span>
              )}
            </dd>
          </div>
          <ProfileField label="Email address" value={profile?.email} />
          <ProfileField label="Employee number" value={profile?.employee_number} />
        </dl>
        <Link className="profile_inline-link" to="/orders">View order history</Link>
      </div>

      <div className="profile_card profile_card--accent">
        <div className="profile_card-header">
          <div className="profile_card-heading">
            <IconMapPin size={18} stroke={1.8} />
            <h3 className="profile_card-title">Food ordering location</h3>
          </div>
          <ProfileSaveActions
            editing={editingLocation}
            onEdit={() => { setLocationError(''); setLocationSuccess(''); setEditingLocation(true); }}
            onCancel={() => setEditingLocation(false)}
            onSave={saveLocation}
            saving={savingLocation}
          />
        </div>
        <ProfileFormMessage error={locationError} success={locationSuccess} />
        {editingLocation ? (
          <div className="profile_edit-grid profile_edit-grid--location">
            <LocationSelect
              label="Preferred site"
              value={locationDraft.preferred_site_id}
              options={siteOptions}
              onChange={(siteId, siteName) => {
                setLocationDraft({
                  preferred_site_id: siteId,
                  preferred_building_id: null,
                });
                setLocationLabels({ site: siteName, building: '' });
              }}
              placeholder="Select a site"
              loading={sitesQuery.isLoading || sitesQuery.isRefreshing}
              error={sitesQuery.error?.message}
              hasMore={hasMorePages(sitesQuery.data?.pagination)}
              onLoadMore={() => setSitePage((page) => page + 1)}
              disabled={savingLocation}
              highlight={editingLocation}
              selectedLabel={locationLabels.site}
            />
            <LocationSelect
              label="Preferred building"
              value={locationDraft.preferred_building_id}
              options={buildingOptions}
              onChange={(buildingId, buildingName) => {
                setLocationDraft((current) => ({
                  ...current,
                  preferred_building_id: buildingId,
                }));
                setLocationLabels((current) => ({ ...current, building: buildingName }));
              }}
              placeholder={locationDraft.preferred_site_id ? 'Select a building' : 'Select a site first'}
              loading={buildingsQuery.isLoading || buildingsQuery.isRefreshing}
              error={buildingsQuery.error?.message}
              hasMore={hasMorePages(buildingsForSite?.pagination)}
              onLoadMore={() => setBuildingPage((page) => page + 1)}
              disabled={savingLocation || !locationDraft.preferred_site_id}
              highlight={editingLocation}
              selectedLabel={locationLabels.building}
            />
          </div>
        ) : (
          <div className="profile_location-grid">
            <div className="profile_location-item">
              <span className="profile_info-label">Preferred site</span>
              <span className="profile_info-value">{siteLabel}</span>
            </div>
            <div className="profile_location-item">
              <span className="profile_info-label">Preferred building</span>
              <span className="profile_info-value">{buildingLabel}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
