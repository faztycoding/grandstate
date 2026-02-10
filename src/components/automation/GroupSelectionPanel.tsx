import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lock, Globe, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GroupItem {
  id: string;
  name: string;
  memberCount: string;
  isPrivate: boolean;
  image?: string;
  isPosted?: boolean;
}

interface GroupSelectionPanelProps {
  groups: GroupItem[];
  selectedGroups: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onSubmit?: () => void;
}

export function GroupSelectionPanel({
  groups,
  selectedGroups,
  onSelectionChange,
  onSubmit,
}: GroupSelectionPanelProps) {
  const toggleGroup = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      onSelectionChange(selectedGroups.filter(id => id !== groupId));
    } else {
      onSelectionChange([...selectedGroups, groupId]);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border-0">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b">
          <p className="text-xs text-blue-600 font-medium">Marketplace</p>
          <h2 className="text-lg font-bold text-gray-900">ลงประกาศในที่อื่นๆ</h2>
        </div>

        {/* Group List */}
        <ScrollArea className="h-[500px]">
          <div className="divide-y">
            {groups.map((group) => (
              <div
                key={group.id}
                className={cn(
                  'flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer',
                  group.isPosted && 'opacity-50'
                )}
                onClick={() => !group.isPosted && toggleGroup(group.id)}
              >
                {/* Group Image */}
                <Avatar className="w-12 h-12 rounded-lg">
                  {group.image ? (
                    <AvatarImage src={group.image} className="object-cover" />
                  ) : (
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white text-lg">
                      {group.name.charAt(0)}
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Group Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {group.name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>สมาชิก {group.memberCount} คน</span>
                    <span>·</span>
                    {group.isPrivate ? (
                      <span className="flex items-center gap-0.5">
                        <Lock className="w-3 h-3" />
                        ส่วนตัว
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <Globe className="w-3 h-3" />
                        สาธารณะ
                      </span>
                    )}
                  </div>
                  {group.isPosted && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      โพสต์แล้ว
                    </Badge>
                  )}
                </div>

                {/* Checkbox */}
                <Checkbox
                  checked={selectedGroups.includes(group.id)}
                  disabled={group.isPosted}
                  className="w-5 h-5 rounded border-2"
                />
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">
              เลือก {selectedGroups.length} กลุ่ม
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600"
              onClick={() => onSelectionChange([])}
            >
              ล้างทั้งหมด
            </Button>
          </div>
          <Button
            variant="accent"
            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
            onClick={onSubmit}
            disabled={selectedGroups.length === 0}
          >
            ประกาศ ({selectedGroups.length} กลุ่ม)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
