import { useState, useCallback, useEffect } from 'react';
import { FacebookGroup } from '@/types/property';
import { API_BASE } from '@/lib/config';

const STORAGE_KEY = 'facebookGroups';

/**
 * =====================================================
 * useGroups Hook - ระบบจัดการกลุ่ม Facebook
 * =====================================================
 * 
 * หลักการทำงาน:
 * 1. โหลดข้อมูลกลุ่มจาก localStorage เมื่อ component mount
 * 2. ทุกการเปลี่ยนแปลง (เพิ่ม/แก้/ลบ) จะบันทึกลง localStorage ทันที
 * 3. มี polling ทุก 500ms เพื่อ sync ข้อมูลระหว่าง components
 * 
 * โครงสร้างข้อมูล FacebookGroup:
 * - id: รหัสกลุ่ม (auto-generate)
 * - name: ชื่อกลุ่ม (ผู้ใช้ตั้งเอง)
 * - url: URL ของกลุ่ม Facebook
 * - groupId: รหัสกลุ่มจาก URL (extract อัตโนมัติ)
 * - memberCount: จำนวนสมาชิก (optional)
 * - isActive: เปิด/ปิดการโพสต์ไปกลุ่มนี้
 * - lastPosted: วันที่โพสต์ล่าสุด
 * - createdAt: วันที่เพิ่มกลุ่ม
 * 
 * วิธีใช้งาน:
 * const { groups, addGroup, updateGroup, deleteGroup, toggleGroupActive } = useGroups();
 */

// ดึง Group ID จาก Facebook URL
export const extractGroupId = (url: string): string => {
  try {
    const patterns = [
      /facebook\.com\/groups\/(\d+)/,
      /facebook\.com\/groups\/([^\/\?]+)/,
      /fb\.com\/groups\/(\d+)/,
      /fb\.com\/groups\/([^\/\?]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return '';
  } catch {
    return '';
  }
};

// โหลดข้อมูลจาก localStorage
const loadFromStorage = (): FacebookGroup[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((item: any) => ({
        id: item.id,
        userId: item.userId || 'user-1',
        name: item.name || '',
        url: item.url || '',
        groupId: item.groupId || extractGroupId(item.url || ''),
        memberCount: item.memberCount,
        postsToday: item.postsToday,
        postsLastMonth: item.postsLastMonth,
        isActive: item.isActive !== false,
        lastPosted: item.lastPosted ? new Date(item.lastPosted) : undefined,
        lastUpdated: item.lastUpdated ? new Date(item.lastUpdated) : undefined,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      }));
    }
  } catch (e) {
    console.error('Error loading groups:', e);
  }
  return [];
};

// บันทึกข้อมูลลง localStorage
const saveToStorage = (groups: FacebookGroup[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.error('Error saving groups:', e);
  }
};

export function useGroups() {
  const [groups, setGroups] = useState<FacebookGroup[]>([]);

  // โหลดข้อมูลเมื่อ mount
  useEffect(() => {
    const loaded = loadFromStorage();
    setGroups(loaded);
  }, []);

  // Polling เพื่อ sync ข้อมูล (ทุก 2 วินาที - ลดการทำงานของ CPU)
  useEffect(() => {
    const interval = setInterval(() => {
      const loaded = loadFromStorage();
      setGroups(loaded);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // เพิ่มกลุ่มใหม่
  const addGroup = useCallback((data: Partial<FacebookGroup>) => {
    const current = loadFromStorage();
    
    // ตรวจสอบว่ามีกลุ่มนี้อยู่แล้วหรือไม่ (จาก URL)
    const groupId = extractGroupId(data.url || '');
    const exists = current.some(g => g.groupId === groupId && groupId !== '');
    if (exists) {
      return null; // กลุ่มซ้ำ
    }

    const newGroup: FacebookGroup = {
      id: `group-${Date.now()}`,
      userId: 'user-1',
      name: data.name || '',
      url: data.url || '',
      groupId: groupId,
      memberCount: data.memberCount,
      postsToday: data.postsToday,
      postsLastMonth: data.postsLastMonth,
      isActive: true,
      lastPosted: undefined,
      lastUpdated: data.lastUpdated || (data.memberCount ? new Date() : undefined),
      createdAt: new Date(),
    } as FacebookGroup;
    
    const updated = [...current, newGroup];
    saveToStorage(updated);
    setGroups(updated);
    return newGroup;
  }, []);

  // แก้ไขกลุ่ม
  const updateGroup = useCallback((id: string, data: Partial<FacebookGroup>) => {
    const current = loadFromStorage();
    const updated = current.map(g => {
      if (g.id === id) {
        const newUrl = data.url || g.url;
        return {
          ...g,
          ...data,
          groupId: extractGroupId(newUrl),
        };
      }
      return g;
    });
    saveToStorage(updated);
    setGroups(updated);
  }, []);

  // ลบกลุ่ม
  const deleteGroup = useCallback((id: string) => {
    const current = loadFromStorage();
    const updated = current.filter(g => g.id !== id);
    saveToStorage(updated);
    setGroups(updated);
  }, []);

  // เปิด/ปิดการโพสต์ไปกลุ่ม
  const toggleGroupActive = useCallback((id: string) => {
    const current = loadFromStorage();
    const updated = current.map(g =>
      g.id === id ? { ...g, isActive: !g.isActive } : g
    );
    saveToStorage(updated);
    setGroups(updated);
  }, []);

  // อัพเดทวันที่โพสต์ล่าสุด
  const updateLastPosted = useCallback((id: string) => {
    const current = loadFromStorage();
    const updated = current.map(g =>
      g.id === id ? { ...g, lastPosted: new Date() } : g
    );
    saveToStorage(updated);
    setGroups(updated);
  }, []);

  // ดึงกลุ่มตาม ID
  const getGroup = useCallback((id: string) => {
    return loadFromStorage().find(g => g.id === id);
  }, []);

  // ดึงข้อมูลกลุ่มจาก Facebook API
  const fetchGroupInfo = useCallback(async (id: string): Promise<boolean> => {
    const current = loadFromStorage();
    const group = current.find(g => g.id === id);
    if (!group) return false;

    try {
      const response = await fetch(`${API_BASE}/api/groups/fetch-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: group.url }),
      });
      
      const result = await response.json();
      
      if (result.success && result.groupInfo) {
        const updated = current.map(g => {
          if (g.id === id) {
            return {
              ...g,
              name: result.groupInfo.name || g.name,
              memberCount: result.groupInfo.memberCount || g.memberCount,
              postsToday: result.groupInfo.postsToday || 0,
              postsLastMonth: result.groupInfo.postsLastMonth || 0,
              lastUpdated: new Date(),
            };
          }
          return g;
        });
        saveToStorage(updated);
        setGroups(updated);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error fetching group info:', error);
      return false;
    }
  }, []);

  // อัพเดทข้อมูลทุกกลุ่มที่เปิดใช้งาน
  const updateAllActiveGroups = useCallback(async (
    onProgress?: (current: number, total: number, groupName: string) => void
  ): Promise<{ success: number; failed: number }> => {
    const current = loadFromStorage();
    const activeGroups = current.filter(g => g.isActive);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < activeGroups.length; i++) {
      const group = activeGroups[i];
      onProgress?.(i + 1, activeGroups.length, group.name);
      
      const result = await fetchGroupInfo(group.id);
      if (result) {
        success++;
      } else {
        failed++;
      }
      
      // Delay between requests to avoid rate limiting
      if (i < activeGroups.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return { success, failed };
  }, [fetchGroupInfo]);

  return {
    groups,
    activeGroups: groups.filter(g => g.isActive),
    inactiveGroups: groups.filter(g => !g.isActive),
    addGroup,
    updateGroup,
    deleteGroup,
    toggleGroupActive,
    updateLastPosted,
    getGroup,
    fetchGroupInfo,
    updateAllActiveGroups,
  };
}
