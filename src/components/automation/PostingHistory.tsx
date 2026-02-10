import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAutomation, PostingHistoryItem } from '@/hooks/useAutomation';
import {
  History,
  Clock,
  CheckCircle2,
  Users,
  Building2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface PostingHistoryProps {
  propertyId?: string;
  showAll?: boolean;
}

export function PostingHistory({ propertyId, showAll = false }: PostingHistoryProps) {
  const { getPostingHistory } = useAutomation();
  const [history, setHistory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getPostingHistory(propertyId);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [propertyId]);

  const postings = history?.postings || [];
  const recentPostings = showAll ? postings : postings.slice(0, 10);

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-accent" />
              ประวัติการโพสต์
            </CardTitle>
            <CardDescription>
              {propertyId 
                ? 'ประวัติการโพสต์ของสินทรัพย์นี้'
                : 'ประวัติการโพสต์ทั้งหมด'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadHistory}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {postings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>ยังไม่มีประวัติการโพสต์</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {recentPostings.map((posting: PostingHistoryItem, index: number) => (
                <div
                  key={`${posting.propertyId}-${posting.groupId}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {posting.groupName || posting.groupId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDistanceToNow(new Date(posting.timestamp), {
                          addSuffix: true,
                          locale: th,
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {new Date(posting.timestamp).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Summary Stats */}
        {history?.stats && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">
                  {history.stats.groups?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">กลุ่มที่โพสต์แล้ว</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {postings.length}
                </p>
                <p className="text-xs text-muted-foreground">โพสต์ทั้งหมด</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
