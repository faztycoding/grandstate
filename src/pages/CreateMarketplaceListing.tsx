import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MarketplacePropertyForm, MarketplaceFormData } from '@/components/automation/MarketplacePropertyForm';
import { GroupSelectionPanel, GroupItem } from '@/components/automation/GroupSelectionPanel';
import { AutomationPanel } from '@/components/automation/AutomationPanel';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Step = 'form' | 'groups' | 'automation';

const mockGroups: GroupItem[] = [
  { id: '1', name: 'ซื้อขาย เท่ากับทะลุยอดแล้ว- โทรศัพท์มือถือราคาถูก ทุกรุ่น', memberCount: '1.9 แสน', isPrivate: false },
  { id: '2', name: 'Apex Legends Thailand community', memberCount: '9.8 พัน', isPrivate: false },
  { id: '3', name: 'ห้อง ซื้อ-ขาย หูฟัง /ลำโพง มือสอง', memberCount: '7.3 หมื่น', isPrivate: true },
  { id: '4', name: 'ซื้อ-ขายซาก อะไหล่ โทรศัพท์ แทบเล็ต และโน้ตบุค มือสอง...', memberCount: '2.1 พัน', isPrivate: false },
  { id: '5', name: 'ซื้อ ขาย ที่ดิน ทั่วประเทศ (กลุ่มใหญ่)', memberCount: '5.6 แสน', isPrivate: false },
  { id: '6', name: 'นวนคร-ปทุมธานี มือสอง', memberCount: '6.8 หมื่น', isPrivate: true },
  { id: '7', name: 'รับซื้อ-ขาย-แลกเปลี่ยน สะสมการ์ดนักฟุตบอลและบาสเก็ตบอ...', memberCount: '9.3 พัน', isPrivate: true },
  { id: '8', name: 'ขาย - หาซื้อ บ้าน ที่ดิน ภูเก็ต', memberCount: '5.7 หมื่น', isPrivate: true },
  { id: '9', name: 'iPhonemod Market Thailand', memberCount: '2.7 แสน', isPrivate: false },
  { id: '10', name: 'Classic & Sports Car Revival Market ตลาดรถสปอร์ต และรถ...', memberCount: '7.7 พัน', isPrivate: false },
];

export default function CreateMarketplaceListing() {
  const [currentStep, setCurrentStep] = useState<Step>('form');
  const [formData, setFormData] = useState<MarketplaceFormData | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const steps = [
    { id: 'form', label: 'กรอกข้อมูล', number: 1 },
    { id: 'groups', label: 'เลือกกลุ่ม', number: 2 },
    { id: 'automation', label: 'ยืนยัน', number: 3 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleFormSubmit = (data: MarketplaceFormData) => {
    setFormData(data);
    setCurrentStep('groups');
  };

  const handleGroupSubmit = () => {
    if (selectedGroups.length === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 กลุ่ม');
      return;
    }
    setCurrentStep('automation');
  };

  const handleBack = () => {
    if (currentStep === 'groups') setCurrentStep('form');
    else if (currentStep === 'automation') setCurrentStep('groups');
  };

  const handleAutomationComplete = (result: any) => {
    toast.success('โพสต์สำเร็จ!');
    // Reset form
    setCurrentStep('form');
    setFormData(null);
    setSelectedGroups([]);
  };

  return (
    <DashboardLayout
      title="สร้างรายการใหม่"
      subtitle="สร้างรายการอสังหาริมทรัพย์แบบ Facebook Marketplace"
    >
      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2',
                currentStepIndex >= index ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  currentStepIndex > index
                    ? 'bg-accent text-white'
                    : currentStepIndex === index
                    ? 'bg-accent text-white'
                    : 'bg-muted'
                )}
              >
                {currentStepIndex > index ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.number
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Navigation */}
      {currentStep !== 'form' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          ย้อนกลับ
        </Button>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex justify-center"
          >
            <MarketplacePropertyForm
              initialData={formData || undefined}
              onChange={setFormData}
              onSubmit={handleFormSubmit}
            />
          </motion.div>
        )}

        {currentStep === 'groups' && (
          <motion.div
            key="groups"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex justify-center"
          >
            <GroupSelectionPanel
              groups={mockGroups}
              selectedGroups={selectedGroups}
              onSelectionChange={setSelectedGroups}
              onSubmit={handleGroupSubmit}
            />
          </motion.div>
        )}

        {currentStep === 'automation' && formData && (
          <motion.div
            key="automation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-md mx-auto space-y-6"
          >
            {/* Summary Card */}
            <div className="bg-white rounded-lg p-4 border shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3">สรุปข้อมูล</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ประเภท:</span>
                  <span>{formData.listingType === 'sale' ? 'ขาย' : 'เช่า'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ราคา:</span>
                  <span>฿{parseInt(formData.price || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ห้องนอน:</span>
                  <span>{formData.bedrooms || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ห้องน้ำ:</span>
                  <span>{formData.bathrooms || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">รูปภาพ:</span>
                  <span>{formData.images.length} รูป</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">กลุ่มที่เลือก:</span>
                  <span>{selectedGroups.length} กลุ่ม</span>
                </div>
              </div>
            </div>

            {/* Automation Panel */}
            <AutomationPanel
              property={{
                id: `prop-${Date.now()}`,
                userId: 'user-1',
                type: formData.propertyType as any || 'house',
                listingType: formData.listingType,
                title: `${formData.propertyType || 'บ้าน'} ${formData.location || ''}`,
                price: parseInt(formData.price || '0'),
                location: formData.location || '',
                district: '',
                province: '',
                size: parseInt(formData.squareMeters || '0'),
                bedrooms: parseInt(formData.bedrooms || '0'),
                bathrooms: parseInt(formData.bathrooms || '0'),
                description: formData.description || '',
                images: formData.images,
                contactName: '',
                contactPhone: '',
                amenities: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              }}
              selectedGroupIds={selectedGroups}
              images={formData.images}
              onComplete={handleAutomationComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
