import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { IconToolsKitchen2, IconBell, IconAlertTriangle } from '@tabler/icons-react';
import { ProfileInput } from '../components/ProfileField.jsx';
import ProfileSaveActions from '../components/ProfileSaveActions.jsx';
import PreferenceToggle from '../components/PreferenceToggle.jsx';
import ProfileFormMessage from '../components/ProfileFormMessage.jsx';
import {
  buildFoodPreferencesPatch,
  buildNotificationsPatch,
  notificationDraftFromProfile,
} from '../profileForms.js';

function ProfileTagGroup({ label, values, warning = false }) {
  return (
    <div className="profile_tag-group">
      <span className="profile_info-label">{label}</span>
      {values.length > 0 ? (
        <div className="profile_tag-list">
          {values.map((value) => (
            <span key={value} className={`profile_tag${warning ? ' profile_tag--warning' : ''}`}>
              {warning && <IconAlertTriangle size={13} stroke={2} />}
              {value}
            </span>
          ))}
        </div>
      ) : (
        <span className="profile_empty">Not set</span>
      )}
    </div>
  );
}

export default function ProfilePreferencesPage() {
  const { profile, saveProfile } = useOutletContext();
  const dietaryPreferences = Array.isArray(profile?.dietary_preferences) ? profile.dietary_preferences : [];
  const allergyIndicators = Array.isArray(profile?.allergy_indicators) ? profile.allergy_indicators : [];
  const [editingFood, setEditingFood] = useState(false);
  const [foodDraft, setFoodDraft] = useState({
    dietary: dietaryPreferences.join(', '),
    allergies: allergyIndicators.join(', '),
  });
  const [savingFood, setSavingFood] = useState(false);
  const [foodError, setFoodError] = useState('');
  const [foodSuccess, setFoodSuccess] = useState('');
  const initialNotifications = notificationDraftFromProfile(profile);
  const [notificationDraft, setNotificationDraft] = useState(initialNotifications);
  const [notificationBaseline, setNotificationBaseline] = useState(initialNotifications);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [notificationSuccess, setNotificationSuccess] = useState('');
  const notificationDirty = Object.keys(notificationDraft).some(
    (key) => notificationDraft[key] !== notificationBaseline[key],
  );

  useEffect(() => {
    setFoodDraft({
      dietary: dietaryPreferences.join(', '),
      allergies: allergyIndicators.join(', '),
    });

    const confirmedNotifications = notificationDraftFromProfile(profile);
    setNotificationDraft(confirmedNotifications);
    setNotificationBaseline(confirmedNotifications);
  }, [profile]);

  const saveFood = async () => {
    const built = buildFoodPreferencesPatch(foodDraft);
    if (built.error) {
      setFoodError(built.error);
      return;
    }

    setFoodError('');
    setFoodSuccess('');
    setSavingFood(true);
    try {
      await saveProfile(built.patch);
      setEditingFood(false);
      setFoodSuccess('Your food preferences have been updated.');
    } catch (err) {
      setFoodError(err?.message || 'Could not save your food preferences. Please try again.');
    } finally {
      setSavingFood(false);
    }
  };

  const saveNotifications = async () => {
    const built = buildNotificationsPatch(notificationDraft, notificationBaseline);
    if (built.error) {
      setNotificationError(built.error);
      return;
    }
    if (Object.keys(built.patch).length === 0) return;

    setNotificationError('');
    setNotificationSuccess('');
    setSavingNotifications(true);
    try {
      const confirmed = await saveProfile(built.patch);
      const confirmedNotifications = notificationDraftFromProfile(confirmed || profile);
      setNotificationBaseline(confirmedNotifications);
      setNotificationDraft(confirmedNotifications);
      setNotificationSuccess('Your notification preferences have been updated.');
    } catch (err) {
      setNotificationError(err?.message || 'Could not update your notification preferences. Please try again.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const cancelNotifications = () => {
    setNotificationDraft(notificationBaseline);
    setNotificationError('');
    setNotificationSuccess('');
  };

  const updateNotificationDraft = (key, value) => {
    setNotificationDraft((current) => ({ ...current, [key]: value }));
    setNotificationError('');
    setNotificationSuccess('');
  };

  return (
    <section className="profile_section profile_section--preferences">
      <div className="profile_card profile_card--feature">
        <div className="profile_card-header">
          <div className="profile_card-heading">
            <IconToolsKitchen2 size={18} stroke={1.8} />
            <h3 className="profile_card-title">Food preferences</h3>
          </div>
          <ProfileSaveActions
            editing={editingFood}
            onEdit={() => { setFoodError(''); setFoodSuccess(''); setEditingFood(true); }}
            onCancel={() => setEditingFood(false)}
            onSave={saveFood}
            saving={savingFood}
          />
        </div>
        <ProfileFormMessage error={foodError} success={foodSuccess} />
        {editingFood ? (
          <div className="profile_edit-grid">
            <ProfileInput
              label="Dietary preferences"
              value={foodDraft.dietary}
              onChange={(value) => setFoodDraft({ ...foodDraft, dietary: value })}
            />
            <ProfileInput
              label="Allergy indicators"
              value={foodDraft.allergies}
              onChange={(value) => setFoodDraft({ ...foodDraft, allergies: value })}
            />
          </div>
        ) : (
          <>
            <ProfileTagGroup label="Dietary preferences" values={dietaryPreferences} />
            <ProfileTagGroup label="Allergy indicators" values={allergyIndicators} warning />
            <p className="profile_section-note">
              Allergy indicators help staff understand personal needs but are not a guarantee of allergen-safe preparation.
            </p>
          </>
        )}
      </div>

      <div className="profile_card profile_card--quiet">
        <div className="profile_card-header">
          <div className="profile_card-heading">
            <IconBell size={18} stroke={1.8} />
            <h3 className="profile_card-title">Notification preferences</h3>
          </div>
          {notificationDirty && (
            <span className="profile_edit-actions">
              <button type="button" className="profile_text-button" onClick={cancelNotifications} disabled={savingNotifications}>
                Cancel
              </button>
              <button
                type="button"
                className="profile_text-button profile_text-button--primary"
                onClick={saveNotifications}
                disabled={savingNotifications}
              >
                {savingNotifications ? 'Saving…' : 'Save'}
              </button>
            </span>
          )}
        </div>
        <ProfileFormMessage error={notificationError} success={notificationSuccess} />
        <div className="profile_toggle-list">
          <PreferenceToggle
            label="Order updates"
            description="Get notified when your order status changes"
            checked={notificationDraft.order_updates}
            disabled={savingNotifications}
            onChange={(value) => updateNotificationDraft('order_updates', value)}
          />
          <PreferenceToggle
            label="Promotions & offers"
            description="News about new vendors and special deals"
            checked={notificationDraft.promotions}
            disabled={savingNotifications}
            onChange={(value) => updateNotificationDraft('promotions', value)}
          />
          <PreferenceToggle
            label="Collection reminders"
            description="Remind me before my order is ready for collection"
            checked={notificationDraft.collection_reminders}
            disabled={savingNotifications}
            onChange={(value) => updateNotificationDraft('collection_reminders', value)}
          />
          <PreferenceToggle
            label="Transactional messages"
            description="Order confirmations and collection codes are required and cannot be disabled"
            checked
            disabled
            onChange={() => {}}
          />
        </div>
      </div>
    </section>
  );
}
