import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Maximize2,
  Play,
  Pause,
  Square,
  X,
  MessageSquareText,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';

interface TaskStatus {
  id: string;
  groupId: string;
  groupName: string;
  groupUrl?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  postUrl?: string;
}

interface TaskProgressPopupProps {
  isRunning: boolean;
  isPaused: boolean;
  tasks: TaskStatus[];
  totalSteps: number;
  completedTasks: number;
  failedTasks: number;
  progressPercent: number;
  generatedCaptions?: string[];
  onStop: () => void;
  onPause: () => void;
  onDismiss?: () => void;
}

export function TaskProgressPopup({
  isRunning,
  isPaused,
  tasks,
  totalSteps,
  completedTasks,
  failedTasks,
  progressPercent,
  generatedCaptions = [],
  onStop,
  onPause,
  onDismiss,
}: TaskProgressPopupProps) {
  const { t, language } = useLanguage();
  const isEn = language === 'en';
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'captions'>('tasks');
  const [selectedCaptionIdx, setSelectedCaptionIdx] = useState(0);

  if (!isRunning && completedTasks === 0 && failedTasks === 0) return null;

  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const isDone = !isRunning && (completedTasks > 0 || failedTasks > 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={cn(
          "fixed bottom-4 right-4 z-50 shadow-2xl rounded-xl border overflow-hidden",
          "bg-background/95 backdrop-blur-xl",
          isMinimized ? "w-auto" : "w-[480px]",
          isDone && completedTasks > 0 && failedTasks === 0 && "border-green-300",
          isDone && failedTasks > 0 && "border-red-300",
          isRunning && "border-accent/50",
        )}
      >
        {/* Header Bar — always visible */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2.5 cursor-pointer select-none",
            isRunning && !isPaused && "bg-gradient-to-r from-amber-500/10 to-orange-500/10",
            isPaused && "bg-yellow-500/10",
            isDone && completedTasks > 0 && failedTasks === 0 && "bg-green-500/10",
            isDone && failedTasks > 0 && "bg-red-500/10",
          )}
          onClick={() => isMinimized ? setIsMinimized(false) : setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2.5">
            {isRunning && !isPaused && (
              <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
            )}
            {isPaused && (
              <Pause className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            )}
            {isDone && failedTasks === 0 && (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            )}
            {isDone && failedTasks > 0 && (
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}

            {!isMinimized && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {isRunning ? (isPaused ? t.automation.paused : t.automation.running) : t.automation.automationDone}
                </span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {completedTasks}/{totalSteps}
                </Badge>
                {failedTasks > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">
                    {failedTasks} ✗
                  </Badge>
                )}
              </div>
            )}

            {isMinimized && (
              <span className="text-sm font-semibold">
                {completedTasks}/{totalSteps}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isRunning && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onPause(); }}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-600"
                  onClick={(e) => { e.stopPropagation(); onStop(); }}
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {!isMinimized && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {isMinimized && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isRunning && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isMinimized && (
              <div className="ml-0.5">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar — always visible when not minimized */}
        {!isMinimized && (
          <div className="px-4 pb-1 pt-0.5">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>
                {isRunning && inProgressTasks > 0 && `⏳ ${t.automation.posting}`}
                {isPaused && `⏸ ${t.automation.paused}`}
                {isDone && `✅ ${t.automation.automationDone}`}
              </span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {!isMinimized && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tab Switcher */}
            <div className="flex border-b mx-3 mb-2">
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors",
                  activeTab === 'tasks'
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('tasks')}
              >
                <List className="w-3.5 h-3.5" />
                {isEn ? 'Tasks' : 'งาน'} ({tasks.length})
              </button>
              {generatedCaptions.length > 0 && (
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors",
                    activeTab === 'captions'
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab('captions')}
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  {isEn ? 'Captions' : 'แคปชั่น'} ({generatedCaptions.length})
                </button>
              )}
            </div>

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <ScrollArea className="h-[320px] px-3 pb-3" type="always">
                <div className="space-y-1.5">
                  {tasks.map((task, idx) => (
                    <div
                      key={task.id}
                      ref={(el) => {
                        if (el && task.status === 'in_progress' && 
                            idx === tasks.findIndex(t => t.status === 'in_progress')) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm",
                        task.status === 'completed' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                        task.status === 'in_progress' && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-300",
                        task.status === 'failed' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                        task.status === 'pending' && "bg-muted/30 border-border"
                      )}
                    >
                      {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      {task.status === 'in_progress' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
                      {task.status === 'failed' && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      {task.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">#{idx + 1}</span>
                          <p className="font-medium text-xs truncate">{task.groupName}</p>
                        </div>
                        {task.message && (
                          <p className="text-[10px] text-muted-foreground truncate ml-5">{task.message}</p>
                        )}
                      </div>
                      {(task.postUrl || task.groupUrl) && (
                        <a
                          href={task.postUrl || task.groupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Captions Tab */}
            {activeTab === 'captions' && generatedCaptions.length > 0 && (
              <div className="px-3 pb-3">
                {/* Caption variant selector */}
                {generatedCaptions.length > 1 && (
                  <div className="flex gap-1.5 mb-2">
                    {generatedCaptions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCaptionIdx(idx)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                          selectedCaptionIdx === idx
                            ? "bg-accent text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {isEn ? `#${idx + 1}` : `แคปชั่น ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Caption content */}
                <ScrollArea className="h-[280px]" type="always">
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                      {generatedCaptions[selectedCaptionIdx] || ''}
                    </pre>
                  </div>
                </ScrollArea>

                {/* Copy button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCaptions[selectedCaptionIdx] || '');
                  }}
                >
                  {isEn ? 'Copy Caption' : 'คัดลอกแคปชั่น'}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
