import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/config';
import { uuidToDisplayId } from '@/lib/displayId';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  display_id: string;
}

export function useUserProfile(userId?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      try {
        const res = await apiFetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.profile && mounted) {
            setProfile(data.profile);
          }
        }
      } catch {
        // silent — display_id is non-critical
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => { mounted = false; };
  }, []);

  // Use API display_id if it's in GS format, otherwise generate deterministic fallback
  const rawId = profile?.display_id || null;
  const displayId = rawId && rawId.startsWith('GS') ? rawId : (userId ? uuidToDisplayId(userId) : null);

  return { profile, displayId, isLoading };
}
