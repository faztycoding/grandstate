import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/config';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  display_id: string;
}

export function useUserProfile() {
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

  return { profile, displayId: profile?.display_id || null, isLoading };
}
