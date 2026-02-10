import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CaptionGenerator } from '@/components/posting/CaptionGenerator';
import { PostPreview } from '@/components/posting/PostPreview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockProperties } from '@/data/mockData';
import { Property } from '@/types/property';
import { Sparkles } from 'lucide-react';

export default function Captions() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    mockProperties[0] || null
  );
  const [caption, setCaption] = useState('');

  return (
    <DashboardLayout title="Caption Generator" subtitle="Create engaging captions with AI">
      <div className="max-w-6xl mx-auto">
        {/* Property Selector */}
        <Card className="mb-6 card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              AI Caption Generator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label className="mb-2 block">Select Property</Label>
              <Select
                value={selectedProperty?.id}
                onValueChange={(value) => {
                  const property = mockProperties.find(p => p.id === value);
                  if (property) setSelectedProperty(property);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a property" />
                </SelectTrigger>
                <SelectContent>
                  {mockProperties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedProperty && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CaptionGenerator
              property={selectedProperty}
              onSelectCaption={(newCaption) => setCaption(newCaption)}
            />
            <PostPreview
              property={selectedProperty}
              caption={caption}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
