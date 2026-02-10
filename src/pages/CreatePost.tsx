import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PropertyCard } from '@/components/property/PropertyCard';
import { GroupCard } from '@/components/groups/GroupCard';
import { CaptionGenerator } from '@/components/posting/CaptionGenerator';
import { PostPreview } from '@/components/posting/PostPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { mockProperties, mockGroups } from '@/data/mockData';
import { Property, FacebookGroup, CaptionStyle } from '@/types/property';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Shuffle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type Step = 'property' | 'groups' | 'caption' | 'preview';

export default function CreatePost() {
  const [step, setStep] = useState<Step>('property');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<FacebookGroup[]>([]);
  const [caption, setCaption] = useState('');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('friendly');
  const [useScheduling, setUseScheduling] = useState(false);
  const [delayRange, setDelayRange] = useState([5, 15]);
  const [randomizeImages, setRandomizeImages] = useState(true);

  const activeGroups = mockGroups.filter(g => g.isActive);

  const steps: { key: Step; label: string; number: number }[] = [
    { key: 'property', label: 'Select Property', number: 1 },
    { key: 'groups', label: 'Choose Groups', number: 2 },
    { key: 'caption', label: 'Generate Caption', number: 3 },
    { key: 'preview', label: 'Review & Post', number: 4 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  const canProceed = () => {
    switch (step) {
      case 'property':
        return !!selectedProperty;
      case 'groups':
        return selectedGroups.length > 0;
      case 'caption':
        return !!caption;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep) setStep(nextStep.key);
  };

  const handleBack = () => {
    const prevStep = steps[currentStepIndex - 1];
    if (prevStep) setStep(prevStep.key);
  };

  const handleGroupSelect = (group: FacebookGroup) => {
    setSelectedGroups(prev =>
      prev.find(g => g.id === group.id)
        ? prev.filter(g => g.id !== group.id)
        : [...prev, group]
    );
  };

  const handlePost = () => {
    toast.success(
      useScheduling
        ? `Scheduled ${selectedGroups.length} posts with ${delayRange[0]}-${delayRange[1]} min delays`
        : 'Post ready! Open Facebook to complete posting.',
      {
        description: 'Remember: Manual confirmation required for each post.',
      }
    );
  };

  return (
    <DashboardLayout title="Create Post" subtitle="Post your property to Facebook groups">
      <div className="max-w-5xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      index < currentStepIndex
                        ? 'bg-success text-success-foreground'
                        : index === currentStepIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      s.number
                    )}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      index === currentStepIndex
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 rounded ${
                      index < currentStepIndex ? 'bg-success' : 'bg-muted'
                    }`}
                    style={{ width: '80px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 1: Select Property */}
            {step === 'property' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Select a property to post</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockProperties.map(property => (
                    <div
                      key={property.id}
                      onClick={() => setSelectedProperty(property)}
                      className={`cursor-pointer transition-all rounded-xl ${
                        selectedProperty?.id === property.id
                          ? 'ring-2 ring-accent ring-offset-2'
                          : ''
                      }`}
                    >
                      <PropertyCard property={property} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Groups */}
            {step === 'groups' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Choose target groups</h2>
                  <Badge variant="secondary">
                    {selectedGroups.length} selected
                  </Badge>
                </div>
                {activeGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeGroups.map(group => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        selectable
                        selected={selectedGroups.some(g => g.id === group.id)}
                        onSelect={handleGroupSelect}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="card-elevated">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        No active groups. Please add groups first.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 3: Generate Caption */}
            {step === 'caption' && selectedProperty && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CaptionGenerator
                  property={selectedProperty}
                  onSelectCaption={(newCaption, style) => {
                    setCaption(newCaption);
                    setCaptionStyle(style);
                  }}
                />
                <PostPreview
                  property={selectedProperty}
                  caption={caption}
                  group={selectedGroups[0]}
                />
              </div>
            )}

            {/* Step 4: Preview & Confirm */}
            {step === 'preview' && selectedProperty && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* Scheduling Options */}
                  <Card className="card-elevated">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-accent" />
                        Posting Options
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Delayed Posting</Label>
                          <p className="text-sm text-muted-foreground">
                            Add random delays between posts
                          </p>
                        </div>
                        <Switch
                          checked={useScheduling}
                          onCheckedChange={setUseScheduling}
                        />
                      </div>

                      {useScheduling && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Delay Range (minutes)</Label>
                              <span className="text-sm font-medium">
                                {delayRange[0]} - {delayRange[1]} min
                              </span>
                            </div>
                            <Slider
                              value={delayRange}
                              onValueChange={setDelayRange}
                              min={1}
                              max={30}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        </motion.div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2">
                            <Shuffle className="w-4 h-4" />
                            Randomize Images
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Change image order per group
                          </p>
                        </div>
                        <Switch
                          checked={randomizeImages}
                          onCheckedChange={setRandomizeImages}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary */}
                  <Card className="card-elevated">
                    <CardHeader>
                      <CardTitle>Posting Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Property</span>
                        <span className="font-medium">{selectedProperty.title}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Groups</span>
                        <span className="font-medium">{selectedGroups.length} selected</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Caption Style</span>
                        <Badge variant="secondary">{captionStyle}</Badge>
                      </div>
                      {useScheduling && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Total Time</span>
                          <span className="font-medium">
                            ~{selectedGroups.length * ((delayRange[0] + delayRange[1]) / 2)} min
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Safety Warning */}
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Manual Confirmation Required</p>
                      <p className="text-sm text-muted-foreground">
                        Each post requires your manual approval on Facebook.
                        This ensures compliance with platform policies.
                      </p>
                    </div>
                  </div>
                </div>

                <PostPreview
                  property={selectedProperty}
                  caption={caption}
                  group={selectedGroups[0]}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {step === 'preview' ? (
            <Button
              variant="accent"
              onClick={handlePost}
              disabled={!canProceed()}
              className="min-w-[140px]"
            >
              <Send className="w-4 h-4 mr-2" />
              {useScheduling ? 'Schedule Posts' : 'Post Now'}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="min-w-[140px]"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
