import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useAutomation } from '@/hooks/useAutomation';
import { Property } from '@/types/property';
import {
  Bot,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Monitor,
  Zap,
  Settings2,
  History,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AutomationPanelProps {
  property: Property | null;
  selectedGroupIds: string[];
  images: string[];
  onComplete?: (result: any) => void;
}

export function AutomationPanel({
  property,
  selectedGroupIds,
  images,
  onComplete,
}: AutomationPanelProps) {
  const automation = useAutomation();
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Check available groups when property changes
  useEffect(() => {
    if (property && selectedGroupIds.length > 0 && preventDuplicates) {
      automation.getAvailableGroupsForProperty(
        property.id,
        selectedGroupIds,
        cooldownHours
      ).then(setAvailableGroups);
    } else {
      setAvailableGroups(selectedGroupIds);
    }
  }, [property?.id, selectedGroupIds, preventDuplicates, cooldownHours]);

  const handleStartAutomation = async () => {
    if (!property) {
      toast.error('กรุณาเลือกสินทรัพย์ก่อน');
      return;
    }

    if (availableGroups.length === 0) {
      toast.error('ไม่มีกลุ่มที่สามารถโพสต์ได้ (อาจโพสต์ไปแล้วทั้งหมด)');
      return;
    }

    const result = await automation.runFullAutomation(property, images, {
      groupIds: availableGroups,
      preventDuplicates,
      cooldownHours,
    });

    if (result?.success) {
      toast.success(`โพสต์สำเร็จไปยัง ${result.postedToGroups?.length || 0} กลุ่ม`);
      onComplete?.(result);
    } else {
      toast.error(result?.message || 'เกิดข้อผิดพลาดในการโพสต์');
    }
  };

  const handleStepByStep = async () => {
    if (!automation.isConnected) {
      await automation.startAutomation();
      toast.info('เปิด Browser แล้ว - กรุณา Login Facebook ถ้ายังไม่ได้ Login');
    }
  };

  const skippedGroups = selectedGroupIds.length - availableGroups.length;

  return (
    <Card className="card-elevated border-accent/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              Facebook Automation
            </CardTitle>
            <CardDescription>
              โพสต์อัตโนมัติไปยัง Facebook Marketplace
            </CardDescription>
          </div>
          <Badge 
            variant={automation.isConnected ? 'default' : 'secondary'}
            className={cn(
              automation.isConnected && 'bg-success text-success-foreground'
            )}
          >
            {automation.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Display */}
        {automation.status.isRunning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {automation.status.currentStep}
              </span>
              <span className="font-medium">{automation.status.progress}%</span>
            </div>
            <Progress value={automation.status.progress} className="h-2" />
          </motion.div>
        )}

        {/* Error Display */}
        <AnimatePresence>
          {automation.error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
            >
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{automation.error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={automation.clearError}
                className="ml-auto"
              >
                ปิด
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Duplicate Prevention Settings */}
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                ป้องกันโพสต์ซ้ำ
              </Label>
              <p className="text-xs text-muted-foreground">
                ข้ามกลุ่มที่เคยโพสต์ property นี้ไปแล้ว
              </p>
            </div>
            <Switch
              checked={preventDuplicates}
              onCheckedChange={setPreventDuplicates}
            />
          </div>

          {preventDuplicates && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between">
                <Label className="text-sm">Cooldown (ชั่วโมง)</Label>
                <span className="text-sm font-medium">{cooldownHours} ชม.</span>
              </div>
              <Slider
                value={[cooldownHours]}
                onValueChange={([v]) => setCooldownHours(v)}
                min={1}
                max={168}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                สามารถโพสต์ซ้ำกลุ่มเดิมได้หลังจาก {cooldownHours} ชั่วโมง
              </p>
            </motion.div>
          )}
        </div>

        {/* Group Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-accent">{availableGroups.length}</p>
            <p className="text-xs text-muted-foreground">กลุ่มพร้อมโพสต์</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{skippedGroups}</p>
            <p className="text-xs text-muted-foreground">กลุ่มข้าม (โพสต์แล้ว)</p>
          </div>
        </div>

        {/* Readiness Checklist */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">ความพร้อม</Label>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              {property ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={property ? '' : 'text-muted-foreground'}>
                {property ? property.title : 'เลือกสินทรัพย์'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {images.length > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={images.length > 0 ? '' : 'text-muted-foreground'}>
                {images.length > 0 ? `${images.length} รูปภาพ` : 'เพิ่มรูปภาพ'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {availableGroups.length > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={availableGroups.length > 0 ? '' : 'text-muted-foreground'}>
                {availableGroups.length > 0 
                  ? `${availableGroups.length} กลุ่มพร้อมโพสต์`
                  : 'เลือกกลุ่ม'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Full Automation Button */}
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={handleStartAutomation}
            disabled={
              automation.isLoading ||
              automation.status.isRunning ||
              !property ||
              availableGroups.length === 0
            }
          >
            {automation.isLoading || automation.status.isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังทำงาน...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                เริ่ม Automation อัตโนมัติ
              </>
            )}
          </Button>

          {/* Step-by-step Controls */}
          <div className="flex gap-2">
            {!automation.isConnected ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleStepByStep}
                disabled={automation.isLoading}
              >
                <Monitor className="w-4 h-4 mr-2" />
                เปิด Browser
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => automation.stopAutomation()}
              >
                <Square className="w-4 h-4 mr-2" />
                หยุด
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Advanced Settings */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-4 border-t"
            >
              <Label className="text-sm font-medium">Step-by-step Controls</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => automation.navigateToMarketplace()}
                  disabled={!automation.isConnected}
                >
                  ไป Marketplace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => automation.createPropertyListing()}
                  disabled={!automation.isConnected}
                >
                  เลือกประเภท
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => property && automation.fillPropertyForm(property, images)}
                  disabled={!automation.isConnected || !property}
                >
                  กรอกฟอร์ม
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => automation.clickNext()}
                  disabled={!automation.isConnected}
                >
                  ถัดไป
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backend Server Reminder */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-sm">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="text-muted-foreground">
            <p className="font-medium text-foreground">ต้องรัน Backend Server</p>
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              cd backend && npm install && npm run dev
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
