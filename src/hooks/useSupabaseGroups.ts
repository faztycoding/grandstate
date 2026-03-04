import { useState, useEffect, useCallback } from 'react';
import { supabase, DbFacebookGroup, directInsert, directUpdate } from '@/lib/supabase';
import { FacebookGroup } from '@/types/property';
import { apiFetch } from '@/lib/config';

// Convert DB format to App format
function dbToGroup(db: DbFacebookGroup): FacebookGroup {
  return {
    id: db.id,
    userId: db.user_id,
    name: db.name,
    url: db.url,
    groupId: db.group_id,
    memberCount: db.member_count || undefined,
    postsToday: db.posts_today || undefined,
    postsLastMonth: db.posts_last_month || undefined,
    isActive: db.is_active,
    lastPosted: db.last_posted ? new Date(db.last_posted) : undefined,
    lastUpdated: db.last_updated ? new Date(db.last_updated) : undefined,
  };
}

// Convert App format to DB format
function groupToDb(group: Partial<FacebookGroup>, userId: string): Record<string, any> {
  return {
    user_id: userId,
    name: group.name || '',
    url: group.url || '',
    group_id: group.groupId || '',
    member_count: group.memberCount ?? 0,
    posts_today: group.postsToday ?? 0,
    posts_last_month: group.postsLastMonth ?? 0,
    is_active: group.isActive ?? true,
    last_posted: group.lastPosted?.toISOString() ?? null,
    last_updated: group.lastUpdated?.toISOString() ?? null,
  };
}

const GROUPS_CACHE_KEY = 'groups_cache';

export function useSupabaseGroups() {
  // Load cached data immediately (no loading flash)
  const [groups, setGroups] = useState<FacebookGroup[]>(() => {
    try {
      const cached = localStorage.getItem(GROUPS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(() => {
    try { return !localStorage.getItem(GROUPS_CACHE_KEY); } catch { return true; }
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch all groups for current user
  const fetchGroups = useCallback(async () => {
    try {
      setError(null);
      // Use getSession() (cached, ~0ms) instead of getUser() (network, ~500ms+)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        const stored = localStorage.getItem('facebookGroups');
        if (stored) {
          setGroups(JSON.parse(stored));
        }
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('facebook_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped = (data || []).map(dbToGroup);
      setGroups(mapped);
      // Cache for instant load next time
      try { localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(mapped)); } catch {}
    } catch (err: any) {
      setError(err.message);
      console.error('[Groups] Fetch error:', err.message, err.code, err.details);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add new group
  const addGroup = useCallback(async (groupData: Partial<FacebookGroup>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Fallback to localStorage if not logged in
        const newGroup: FacebookGroup = {
          id: Date.now().toString(),
          userId: 'temp',
          name: groupData.name || '',
          url: groupData.url || '',
          groupId: groupData.groupId || '',
          memberCount: groupData.memberCount,
          postsToday: groupData.postsToday,
          postsLastMonth: groupData.postsLastMonth,
          isActive: groupData.isActive ?? true,
          lastPosted: groupData.lastPosted,
          lastUpdated: groupData.lastUpdated,
        };

        const stored = localStorage.getItem('facebookGroups');
        const groups = stored ? JSON.parse(stored) : [];
        groups.unshift(newGroup);
        localStorage.setItem('facebookGroups', JSON.stringify(groups));
        setGroups(groups);
        return newGroup;
      }

      const dbData = groupToDb(groupData, user.id);

      try {
        await directInsert('facebook_groups', dbData);
      } catch (err: any) {
        if (err.code === '23505') return null;
        throw err;
      }

      await fetchGroups();
      return { id: 'new' } as FacebookGroup;
    } catch (err: any) {
      console.error('Error adding group:', err);
      throw err;
    }
  }, []);

  // Update group
  const updateGroup = useCallback(async (id: string, updates: Partial<FacebookGroup>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Fallback to localStorage if not logged in
        const stored = localStorage.getItem('facebookGroups');
        if (stored) {
          const groups = JSON.parse(stored);
          const index = groups.findIndex((g: FacebookGroup) => g.id === id);
          if (index !== -1) {
            groups[index] = { ...groups[index], ...updates };
            localStorage.setItem('facebookGroups', JSON.stringify(groups));
            setGroups(groups);
            return groups[index];
          }
        }
        return;
      }

      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.url) dbUpdates.url = updates.url;
      if (updates.memberCount !== undefined) dbUpdates.member_count = updates.memberCount;
      if (updates.postsToday !== undefined) dbUpdates.posts_today = updates.postsToday;
      if (updates.postsLastMonth !== undefined) dbUpdates.posts_last_month = updates.postsLastMonth;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.lastPosted) dbUpdates.last_posted = updates.lastPosted.toISOString();
      if (updates.lastUpdated) dbUpdates.last_updated = updates.lastUpdated.toISOString();

      await directUpdate('facebook_groups', dbUpdates, { id, user_id: user.id });

      await fetchGroups();
    } catch (err: any) {
      console.error('Error updating group:', err);
      throw err;
    }
  }, []);

  // Delete group
  const deleteGroup = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Fallback to localStorage if not logged in
        const stored = localStorage.getItem('facebookGroups');
        if (stored) {
          const groups = JSON.parse(stored);
          const filtered = groups.filter((g: FacebookGroup) => g.id !== id);
          localStorage.setItem('facebookGroups', JSON.stringify(filtered));
          setGroups(filtered);
        }
        return;
      }

      const { error } = await supabase
        .from('facebook_groups')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      console.error('Error deleting group:', err);
      throw err;
    }
  }, []);

  // Delete ALL groups
  const deleteAllGroups = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        localStorage.setItem('facebookGroups', JSON.stringify([]));
        setGroups([]);
        return;
      }

      const { error } = await supabase
        .from('facebook_groups')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setGroups([]);
    } catch (err: any) {
      console.error('Error deleting all groups:', err);
      throw err;
    }
  }, []);

  // Toggle group active status
  const toggleGroupActive = useCallback(async (id: string) => {
    const group = groups.find(g => g.id === id);
    if (!group) return;

    return updateGroup(id, { isActive: !group.isActive });
  }, [groups, updateGroup]);

  // Start background update of all active groups on the server
  const startBackgroundUpdate = useCallback(async () => {
    const activeGroupsList = groups.filter(g => g.isActive);
    if (activeGroupsList.length === 0) return { success: false, error: 'No active groups' };

    const payload = activeGroupsList.map(g => ({
      id: g.id,
      url: g.url,
      name: g.name,
      memberCount: g.memberCount,
      postsToday: g.postsToday,
      postsLastMonth: g.postsLastMonth,
    }));

    const res = await apiFetch('/api/groups/update-all', {
      method: 'POST',
      body: JSON.stringify({ groups: payload }),
    });
    return res.json();
  }, [groups]);

  // Poll background update status
  const pollUpdateStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/groups/update-all/status');
      return res.json();
    } catch {
      return { success: false, status: 'error' };
    }
  }, []);

  // Cancel background update
  const cancelBackgroundUpdate = useCallback(async () => {
    try {
      const res = await apiFetch('/api/groups/update-all/cancel', { method: 'POST' });
      return res.json();
    } catch {
      return { success: false };
    }
  }, []);

  // Get active/inactive groups
  const activeGroups = groups.filter(g => g.isActive);
  const inactiveGroups = groups.filter(g => !g.isActive);

  // Fetch on mount + auth changes (debounced, skip duplicate on mount)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    fetchGroups();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { if (mounted) fetchGroups(); }, 300);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [fetchGroups]);

  return {
    groups,
    activeGroups,
    inactiveGroups,
    loading,
    error,
    addGroup,
    updateGroup,
    deleteGroup,
    deleteAllGroups,
    toggleGroupActive,
    startBackgroundUpdate,
    pollUpdateStatus,
    cancelBackgroundUpdate,
    refetch: fetchGroups,
  };
}
