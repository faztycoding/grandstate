import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GroupCard } from '@/components/groups/GroupCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useSupabaseGroups } from '@/hooks/useSupabaseGroups';
import { extractGroupId } from '@/hooks/useGroups';
import { FacebookGroup } from '@/types/property';
import { Plus, Link as LinkIcon, Users, Search, Loader2, RefreshCw, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { BulkAddGroupDialog } from '@/components/automation/BulkAddGroupDialog';
import { canAddGroup, getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';

import { apiFetch } from '@/lib/config';

/**
 * =====================================================
 * หน้าจัดการกลุ่ม Facebook - Groups Page
 * =====================================================
 * 
 * ฟีเจอร์:
 * 1. ดูรายการกลุ่มทั้งหมด (แยก Active/Inactive)
 * 2. เพิ่มกลุ่มใหม่ด้วย URL
 * 3. แก้ไขชื่อกลุ่ม
 * 4. ลบกลุ่ม (มี confirm dialog)
 * 5. เปิด/ปิดการโพสต์ไปกลุ่ม
 * 6. ค้นหากลุ่ม
 * 
 * การเก็บข้อมูล:
 * - ใช้ useGroups hook ที่เก็บข้อมูลใน localStorage
 * - Key: 'facebookGroups'
 * - ข้อมูล sync อัตโนมัติทุก 500ms
 */

export default function Groups() {
  const { t } = useLanguage();
  const { groups, activeGroups, inactiveGroups, loading: groupsLoading, error: groupsError, addGroup, updateGroup, deleteGroup, deleteAllGroups, toggleGroupActive, updateAllActiveGroups } = useSupabaseGroups();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<FacebookGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [formUrl, setFormUrl] = useState('');
  const [formName, setFormName] = useState('');
  const [formMemberCount, setFormMemberCount] = useState<number | undefined>(undefined);
  const [formPostsToday, setFormPostsToday] = useState<number | undefined>(undefined);
  const [formPostsLastMonth, setFormPostsLastMonth] = useState<number | undefined>(undefined);
  const [isFetching, setIsFetching] = useState(false);
  
  // Update all groups state
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, groupName: '' });

  // Package limits
  const userPkg = getUserPackage();
  const groupCheck = canAddGroup(groups.length, userPkg);
  const pkgLimits = getPackageLimits(userPkg);

  // Filter groups by search
  const filteredActive = activeGroups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.url.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredInactive = inactiveGroups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormUrl('');
    setFormName('');
    setFormMemberCount(undefined);
    setFormPostsToday(undefined);
    setFormPostsLastMonth(undefined);
    setSelectedGroup(null);
    setIsFetching(false);
  };

  // Fetch group info from Facebook using Puppeteer
  const fetchGroupInfo = async (url: string) => {
    if (!url || !url.includes('facebook.com/groups')) {
      return;
    }
    
    setIsFetching(true);
    try {
      const response = await apiFetch('/api/groups/fetch-info', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (data.success && data.groupInfo) {
        // Auto-fill the name if we got it
        if (data.groupInfo.name && !formName) {
          setFormName(data.groupInfo.name);
        }
        
        // Store all info for later use when saving
        if (data.groupInfo.memberCount) {
          setFormMemberCount(data.groupInfo.memberCount);
        }
        if (data.groupInfo.postsToday !== undefined) {
          setFormPostsToday(data.groupInfo.postsToday);
        }
        if (data.groupInfo.postsLastMonth !== undefined) {
          setFormPostsLastMonth(data.groupInfo.postsLastMonth);
        }
        
        // Show success toast with all info
        const infoLines = [`สมาชิก: ${(data.groupInfo.memberCount || 0).toLocaleString()} คน`];
        if (data.groupInfo.postsToday > 0) {
          infoLines.push(`โพสต์วันนี้: ${data.groupInfo.postsToday.toLocaleString()}`);
        }
        if (data.groupInfo.postsLastMonth > 0) {
          infoLines.push(`โพสต์/เดือน: ${data.groupInfo.postsLastMonth.toLocaleString()}`);
        }
        
        toast.success(`พบกลุ่ม: ${data.groupInfo.name}`, {
          description: infoLines.join(' | '),
        });
      }
    } catch (error) {
      console.error('Failed to fetch group info:', error);
      // Don't show error - just let user continue manually
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddGroup = async () => {
    if (!formUrl || !formName) {
      toast.error(t.groups.fillRequired);
      return;
    }

    const groupId = extractGroupId(formUrl);
    if (!groupId) {
      toast.error(t.groups.invalidUrl);
      return;
    }

    try {
      const result = await addGroup({
        name: formName,
        url: formUrl,
        groupId: groupId,
        memberCount: formMemberCount,
        postsToday: formPostsToday,
        postsLastMonth: formPostsLastMonth,
        lastUpdated: formMemberCount ? new Date() : undefined,
      });

      if (result === null) {
        toast.error(t.groups.alreadyExists);
        return;
      }

      resetForm();
      setIsAddOpen(false);
      toast.success(t.groups.addSuccess, {
        description: formName,
      });
    } catch (err: any) {
      console.error('Add group error:', err);
      toast.error('เพิ่มกลุ่มไม่สำเร็จ: ' + (err.message || 'Unknown error'));
    }
  };

  const handleEditGroup = async () => {
    if (!selectedGroup || !formName) {
      toast.error(t.groups.fillRequired);
      return;
    }

    try {
      await updateGroup(selectedGroup.id, {
        name: formName,
        url: formUrl || selectedGroup.url,
      });
      resetForm();
      setIsEditOpen(false);
      toast.success(t.groups.editSuccess);
    } catch (err: any) {
      toast.error('แก้ไขไม่สำเร็จ: ' + (err.message || 'Unknown error'));
    }
  };

  const openEditDialog = (group: FacebookGroup) => {
    setSelectedGroup(group);
    setFormName(group.name);
    setFormUrl(group.url);
    setIsEditOpen(true);
  };

  const handleToggleActive = async (group: FacebookGroup) => {
    try {
      await toggleGroupActive(group.id);
      toast.success(group.isActive ? t.groups.postDisabled : t.groups.postEnabled);
    } catch (err: any) {
      toast.error('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedGroup) {
      try {
        await deleteGroup(selectedGroup.id);
        toast.success(t.groups.deleteSuccess);
      } catch (err: any) {
        toast.error('ลบไม่สำเร็จ: ' + (err.message || 'Unknown error'));
      }
      setIsDeleteOpen(false);
      setSelectedGroup(null);
    }
  };

  const openDeleteDialog = (group: FacebookGroup) => {
    setSelectedGroup(group);
    setIsDeleteOpen(true);
  };

  // Handle update all active groups
  const handleUpdateAllGroups = async () => {
    if (activeGroups.length === 0) {
      toast.error('ไม่มีกลุ่มที่เปิดใช้งาน');
      return;
    }
    
    setIsUpdatingAll(true);
    setUpdateProgress({ current: 0, total: activeGroups.length, groupName: '' });
    
    toast.info(`กำลังอัพเดทข้อมูล ${activeGroups.length} กลุ่ม...`, {
      description: 'กรุณารอสักครู่',
    });

    try {
      const result = await updateAllActiveGroups((current, total, groupName) => {
        setUpdateProgress({ current, total, groupName });
      });
      
      if (result.success > 0) {
        toast.success(`อัพเดทสำเร็จ ${result.success} กลุ่ม`, {
          description: result.failed > 0 ? `ล้มเหลว ${result.failed} กลุ่ม` : undefined,
        });
      } else {
        toast.error('ไม่สามารถอัพเดทข้อมูลได้', {
          description: 'ตรวจสอบการเชื่อมต่อ Facebook',
        });
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอัพเดท');
    } finally {
      setIsUpdatingAll(false);
      setUpdateProgress({ current: 0, total: 0, groupName: '' });
    }
  };

  return (
    <DashboardLayout title={t.groups.title} subtitle={t.groups.subtitle}>
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Card className="bg-primary/5 border-0">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{groups.length}</p>
                  <p className="text-xs text-muted-foreground">{t.groups.totalGroups}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-0">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="text-2xl font-bold">{activeGroups.length}</p>
                  <p className="text-xs text-muted-foreground">{t.groups.active}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.groups.searchGroups}
                className="pl-10 w-full sm:w-[200px]"
              />
            </div>
            
            {/* Update All Groups Button */}
            <Button 
              variant="outline"
              size="sm"
              onClick={handleUpdateAllGroups}
              disabled={isUpdatingAll || activeGroups.length === 0}
            >
              {isUpdatingAll ? (
                <>
                  <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">{updateProgress.current}/{updateProgress.total}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t.groups.updateInfo}</span>
                </>
              )}
            </Button>
            
            {/* Delete All Groups Button */}
            {groups.length > 0 && (
              <Button 
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setIsDeleteAllOpen(true)}
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t.settingsPage.deleteAll}</span>
              </Button>
            )}
            
            {/* Add Group Button */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {groups.length}/{pkgLimits.maxGroups}
              </span>
              <Button
                variant="accent"
                size="sm"
                disabled={!groupCheck.allowed}
                onClick={() => {
                  if (!groupCheck.allowed) {
                    toast.error(`แพ็คเกจ ${userPkg.toUpperCase()} เพิ่มกลุ่มได้สูงสุด ${pkgLimits.maxGroups} กลุ่ม`, {
                      description: 'อัพเกรดแพ็คเกจเพื่อเพิ่มกลุ่มได้มากขึ้น',
                    });
                    return;
                  }
                  setIsAddOpen(true);
                }}
              >
                {!groupCheck.allowed ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {t.groups.addGroup}
              </Button>
            </div>
          </div>
        </div>

        {/* Active Groups */}
        {filteredActive.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              {t.groups.activeGroups} ({filteredActive.length})
            </h2>
            <div className="space-y-2">
              {filteredActive.map((group, index) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onToggleActive={handleToggleActive}
                  onDelete={openDeleteDialog}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          </div>
        )}

        {/* Inactive Groups */}
        {filteredInactive.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              {t.groups.inactiveGroups} ({filteredInactive.length})
            </h2>
            <div className="space-y-2">
              {filteredInactive.map((group, index) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onToggleActive={handleToggleActive}
                  onDelete={openDeleteDialog}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          </div>
        )}

        {/* Supabase Error Banner */}
        {groupsError && (
          <Card className="border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
            <CardContent className="py-4">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">⚠️ Supabase Error: {groupsError}</p>
              <p className="text-xs text-muted-foreground mt-1">ตรวจสอบว่าตาราง facebook_groups มีอยู่ใน Supabase และ RLS policies ถูกต้อง</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {groupsLoading && groups.length === 0 && !groupsError && (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">กำลังโหลดกลุ่ม...</p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!groupsLoading && groups.length === 0 && !groupsError && (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t.groups.noGroups}</h3>
              <p className="text-muted-foreground mb-4">
                {t.groups.noGroupsDesc}
              </p>
              <Button variant="accent" onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t.groups.addFirst}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.groups.editGroup}</DialogTitle>
              <DialogDescription>
                {t.groups.editGroupDesc}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t.groups.groupName}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น ซื้อขายบ้าน กรุงเทพ"
                />
              </div>
              <div className="space-y-2">
                <Label>URL กลุ่ม Facebook</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://facebook.com/groups/..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>
                {t.common.cancel}
              </Button>
              <Button variant="accent" onClick={handleEditGroup}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.groups.deleteConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.groups.deleteConfirmDesc.replace('{name}', selectedGroup?.name || '')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedGroup(null)}>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t.groups.deleteGroup}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All Confirmation Dialog */}
        <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.settingsPage.deleteAllTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.settingsPage.deleteAllDesc} ({groups.length} {t.groups.totalGroups})
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction 
                onClick={async () => {
                  try {
                    await deleteAllGroups();
                    toast.success(`ลบกลุ่มทั้งหมด ${groups.length} กลุ่มสำเร็จ`);
                  } catch {
                    toast.error('เกิดข้อผิดพลาดในการลบ');
                  }
                  setIsDeleteAllOpen(false);
                }} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t.settingsPage.deleteAllConfirm} ({groups.length})
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Add Group Dialog — single + bulk modes with duplicate prevention */}
        <BulkAddGroupDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          existingGroupUrls={groups.map(g => g.url)}
          onAddGroups={async (newGroups) => {
            let added = 0;
            let duplicated = 0;
            let overLimit = 0;
            const currentCount = groups.length;
            const maxGroups = pkgLimits.maxGroups;

            for (const g of newGroups) {
              if (currentCount + added >= maxGroups) {
                overLimit++;
                continue;
              }
              try {
                const groupId = extractGroupId(g.url);
                const result = await addGroup({
                  name: g.name,
                  url: g.url,
                  groupId: groupId,
                  memberCount: g.memberCount,
                  postsToday: g.postsToday,
                  postsLastMonth: g.postsLastMonth,
                  lastUpdated: new Date(),
                });
                if (result === null) {
                  duplicated++;
                } else {
                  added++;
                }
              } catch (err) {
                console.error('Error adding group:', err);
              }
            }
            if (added > 0) {
              toast.success(`เพิ่ม ${added} กลุ่มสำเร็จ!`);
            }
            if (duplicated > 0) {
              toast.warning(`${duplicated} กลุ่มมีอยู่แล้ว — ข้าม`);
            }
            if (overLimit > 0) {
              toast.error(`${overLimit} กลุ่มเกินลิมิต (${maxGroups} กลุ่ม) — อัพเกรดแพ็คเกจ`);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
