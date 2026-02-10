import { FacebookGroup } from '@/types/property';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Users, Trash2, Clock, Pencil, Globe, MessageSquare, CalendarClock, ExternalLink } from 'lucide-react';
import { th } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  group: FacebookGroup;
  onToggleActive?: (group: FacebookGroup) => void;
  onDelete?: (group: FacebookGroup) => void;
  onEdit?: (group: FacebookGroup) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (group: FacebookGroup) => void;
}

export function GroupCard({
  group,
  onToggleActive,
  onDelete,
  onEdit,
  selectable,
  selected,
  onSelect,
}: GroupCardProps) {
  const formatMembers = (count?: number) => {
    if (!count) return 'ไม่ทราบจำนวนสมาชิก';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M สมาชิก`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K สมาชิก`;
    return `${count.toLocaleString()} สมาชิก`;
  };

  const formatPosts = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  const formatLastUpdated = (date?: Date) => {
    if (!date) return null;
    return formatDistanceToNow(date, { addSuffix: true, locale: th });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition-all duration-300",
        "hover:shadow-lg hover:border-primary/30",
        "cursor-pointer",
        selected && "border-2 border-accent bg-accent/5 shadow-md",
        !group.isActive && "opacity-70"
      )}
      onClick={(e) => {
        // If clicking action buttons area, don't navigate
        if ((e.target as HTMLElement).closest('[data-actions]')) return;
        if (selectable) {
          onSelect?.(group);
        } else {
          window.open(group.url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {/* Active indicator bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-colors",
        group.isActive ? "bg-green-500" : "bg-gray-300"
      )} />

      <div className="flex items-center gap-4 p-4 pl-5">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
          group.isActive 
            ? "bg-gradient-to-br from-blue-500 to-blue-600" 
            : "bg-gray-200"
        )}>
          <Users className={cn(
            "w-6 h-6",
            group.isActive ? "text-white" : "text-gray-500"
          )} />
        </div>

        {/* Content - Full width for long names */}
        <div className="flex-1 min-w-0">
          {/* Group Name - Can wrap to multiple lines */}
          <h3 className={cn(
            "font-semibold text-base leading-tight mb-1",
            group.isActive ? "text-foreground" : "text-muted-foreground"
          )}>
            {group.name}
          </h3>
          
          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {/* Member count */}
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {formatMembers(group.memberCount)}
            </span>
            
            {/* Posts today */}
            <span className={cn(
              "flex items-center gap-1 font-medium",
              (group.postsToday || 0) > 0 ? "text-blue-600" : "text-muted-foreground/60"
            )}>
              <MessageSquare className="w-3.5 h-3.5" />
              {(group.postsToday || 0) > 0 ? formatPosts(group.postsToday) : '-'}
              <span className="text-xs">โพสต์วันนี้</span>
            </span>
            
            {/* Posts last month */}
            <span className={cn(
              "flex items-center gap-1",
              (group.postsLastMonth || 0) > 0 ? "text-muted-foreground" : "text-muted-foreground/60"
            )}>
              <MessageSquare className="w-3.5 h-3.5" />
              {(group.postsLastMonth || 0) > 0 ? formatPosts(group.postsLastMonth) : '-'}
              <span className="text-xs">โพสต์/เดือน</span>
            </span>
            
            {/* Last updated */}
            {group.lastUpdated && (
              <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                อัปเดต{formatLastUpdated(group.lastUpdated)}
              </span>
            )}
          </div>
        </div>

        {/* Actions — data-actions prevents card click from navigating */}
        {!selectable && (
          <div className="flex items-center gap-1 flex-shrink-0" data-actions>
            {/* Status Badge */}
            <Badge 
              variant={group.isActive ? 'default' : 'secondary'}
              className={cn(
                "mr-2",
                group.isActive && "bg-green-500 hover:bg-green-600"
              )}
            >
              {group.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
            </Badge>

            {/* Toggle Switch */}
            <Switch
              checked={group.isActive}
              onCheckedChange={() => onToggleActive?.(group)}
              className="data-[state=checked]:bg-green-500"
            />
            
            {/* Open group URL */}
            <a
              href={group.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
              onClick={(e) => e.stopPropagation()}
              title="เปิดกลุ่ม"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Edit */}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(group);
                }}
                title="แก้ไข"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            
            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(group);
              }}
              title="ลบ"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Selectable checkbox */}
        {selectable && (
          <div className="flex items-center flex-shrink-0">
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                selected
                  ? "border-accent bg-accent"
                  : "border-muted-foreground/30 group-hover:border-accent/50"
              )}
            >
              {selected && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-4 h-4 text-accent-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </motion.svg>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
