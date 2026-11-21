import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
import ProfileHeader from './components/ProfileHeader.jsx';
import ProfileSidebar from './components/ProfileSidebar.jsx';
import ProfileOverviewSkeleton from './ProfileOverviewSkeleton.jsx';
import ProfileAccessSkeleton from './ProfileAccessSkeleton.jsx';
import './profile.css';

/**
 * Owns the persistent profile shell: header, route-aware sidebar, and the
 * routed section. Profile state is mirrored only from confirmed auth updates.
 */
export default function ProfileLayout() {
  const { profile, profileLoading, user, session, signOut, updateProfile } = useAuth();
  const [displayProfile, setDisplayProfile] = useState(profile);

  useEffect(() => {
    setDisplayProfile(profile);
  }, [profile]);

  const token = session?.access_token ?? null;
  const location = useLocation();
  const isOverviewRoute = ['/profile', '/profile/overview'].includes(location.pathname);
  const isAccessRoute = location.pathname === '/profile/access';
  const showInitialSkeleton = profileLoading && !displayProfile;

  return (
    <PageContainer className="profile_page-container">
      <div className="profile_page">
        <aside className="profile_sidebar">
          <ProfileSidebar />
        </aside>

        <main className="profile_content">
          {showInitialSkeleton && isOverviewRoute ? (
            <ProfileOverviewSkeleton />
          ) : showInitialSkeleton && isAccessRoute ? (
            <ProfileAccessSkeleton />
          ) : (
            <>
              <ProfileHeader profile={displayProfile} user={user} />
              {showInitialSkeleton ? (
                <div className="profile_loading">
                  <div className="profile_loading-bar" />
                  <div className="profile_loading-bar profile_loading-bar--short" />
                </div>
              ) : (
                <Outlet context={{ profile: displayProfile, user, token, saveProfile: updateProfile, signOut }} />
              )}
            </>
          )}
        </main>
      </div>
    </PageContainer>
  );
}
