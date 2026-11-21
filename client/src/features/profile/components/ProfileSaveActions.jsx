import { IconPencil, IconCheck, IconX } from '@tabler/icons-react';

export default function ProfileSaveActions({
  editing,
  onEdit,
  onCancel,
  onSave,
  saving = false,
}) {
  if (!editing) {
    return (
      <button type="button" className="profile_text-button" onClick={onEdit}>
        <IconPencil size={15} /> Edit
      </button>
    );
  }

  return (
    <span className="profile_edit-actions">
      <button type="button" className="profile_text-button" onClick={onCancel} disabled={saving}>
        <IconX size={15} /> Cancel
      </button>
      <button
        type="button"
        className="profile_text-button profile_text-button--primary"
        onClick={onSave}
        disabled={saving}
      >
        <IconCheck size={15} /> {saving ? 'Saving…' : 'Save'}
      </button>
    </span>
  );
}
