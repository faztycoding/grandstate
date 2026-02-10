import { useState, useEffect, useCallback } from 'react';
import { supabase, DbFacebookGroup } from '@/lib/supabase';
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
function groupToDb(group: Partial<FacebookGroup>, userId: string): Partial<DbFacebookGroup> {
  return {
    user_id: userId,
    name: group.name,
    url: group.url,
    group_id: group.groupId,
    member_count: group.memberCount || null,
    posts_today: group.postsToday || null,
    posts_last_month: group.postsLastMonth || null,
    is_active: group.isActive ?? true,
    last_posted: group.lastPosted?.toISOString() || null,
    last_updated: group.lastUpdated?.toISOString() || null,
  };
}

export function useSupabaseGroups() {
  const [groups, setGroups] = useState<FacebookGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all groups for current user
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('[Groups] Auth user:', user?.id || 'NOT LOGGED IN');
      
      if (!user) {
        // Fallback to localStorage if not logged in
        const stored = localStorage.getItem('facebookGroups');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('[Groups] localStorage fallback:', parsed.length, 'groups');
          setGroups(parsed);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('facebook_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('[Groups] Supabase fetch:', { data: data?.length || 0, error: fetchError?.message || null });

      if (fetchError) throw fetchError;

      setGroups((data || []).map(dbToGroup));
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
      
      const { error } = await supabase
        .from('facebook_groups')
        .insert([dbData]);

      if (error) {
        if (error.code === '23505') {
          return null;
        }
        throw error;
      }

      // Refetch to get the new data with proper types
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

      const { error } = await supabase
        .from('facebook_groups')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

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

  // Update all active groups - fetch info from Facebook
  const updateAllActiveGroups = useCallback(async (
    onProgress?: (current: number, total: number, groupName: string) => void
  ) => {
    const activeGroupsList = groups.filter(g => g.isActive);
    let success = 0;
    let failed = 0;

    // Blacklist: names that are Facebook UI elements, NOT group names
    const nameBlacklist = [
      'การแจ้งเตือน', 'แชท', 'Chat', 'Notifications', 'Messenger',
      'Facebook', 'หน้าหลัก', 'Home', 'Watch', 'Marketplace',
      'สร้าง', 'Create', 'เมนู', 'Menu',
    ];
    const isValidName = (name: string) => {
      if (!name || name.length < 3) return false;
      return !nameBlacklist.some(b => name === b || name.startsWith(b + ' '));
    };

    for (let i = 0; i < activeGroupsList.length; i++) {
      const group = activeGroupsList[i];
      onProgress?.(i + 1, activeGroupsList.length, group.name);

      try {
        const response = await apiFetch('/api/groups/fetch-info', {
          method: 'POST',
          body: JSON.stringify({ url: group.url }),
        });

        const data = await response.json();
        if (data.success && data.groupInfo) {
          // Only update name if scraped name is valid (not a FB UI element)
          const scrapedName = data.groupInfo.name || '';
          const newName = isValidName(scrapedName) ? scrapedName : group.name;

          await updateGroup(group.id, {
            name: newName,
            memberCount: data.groupInfo.memberCount || group.memberCount || 0,
            postsToday: data.groupInfo.postsToday || 0,
            postsLastMonth: data.groupInfo.postsLastMonth || 0,
            lastUpdated: new Date(),
          });
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      // Delay between requests
      if (i < activeGroupsList.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return { success, failed };
  }, [groups, updateGroup]);

  // Get active/inactive groups
  const activeGroups = groups.filter(g => g.isActive);
  const inactiveGroups = groups.filter(g => !g.isActive);

  // Initial fetch
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchGroups();
    });

    return () => subscription.unsubscribe();
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
    updateAllActiveGroups,
    refetch: fetchGroups,
  };
}
