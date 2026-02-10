import { useState } from 'react';
import { Property, CaptionStyle } from '@/types/property';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Copy, Check, Smile, Briefcase, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { captionTemplates } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CaptionGeneratorProps {
  property: Property;
  onSelectCaption?: (caption: string, style: CaptionStyle) => void;
}

const styleOptions: { value: CaptionStyle; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'friendly', label: 'Friendly', icon: <Smile className="w-5 h-5" />, description: 'Warm, approachable tone with emojis' },
  { value: 'professional', label: 'Professional', icon: <Briefcase className="w-5 h-5" />, description: 'Formal, business-like presentation' },
  { value: 'casual', label: 'Casual', icon: <Coffee className="w-5 h-5" />, description: 'Relaxed, conversational style' },
];

const formatPrice = (price: number, listingType: 'sale' | 'rent') => {
  if (price >= 1000000) {
    return `฿${(price / 1000000).toFixed(1)}M${listingType === 'rent' ? '/month' : ''}`;
  }
  return `฿${price.toLocaleString()}${listingType === 'rent' ? '/month' : ''}`;
};

const generateCaption = (property: Property, style: CaptionStyle): string => {
  const templates = captionTemplates[style];
  const template = templates[Math.floor(Math.random() * templates.length)];

  return template
    .replace(/{title}/g, property.title)
    .replace(/{type}/g, property.type)
    .replace(/{location}/g, `${property.location}, ${property.district}`)
    .replace(/{bedrooms}/g, String(property.bedrooms))
    .replace(/{bathrooms}/g, String(property.bathrooms))
    .replace(/{size}/g, String(property.size))
    .replace(/{price}/g, formatPrice(property.price, property.listingType))
    .replace(/{description}/g, property.description)
    .replace(/{phone}/g, property.contactPhone);
};

export function CaptionGenerator({ property, onSelectCaption }: CaptionGeneratorProps) {
  const [selectedStyle, setSelectedStyle] = useState<CaptionStyle>('friendly');
  const [caption, setCaption] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate AI generation delay
    setTimeout(() => {
      const newCaption = generateCaption(property, selectedStyle);
      setCaption(newCaption);
      setIsGenerating(false);
    }, 500);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    toast.success('Caption copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelect = () => {
    if (caption) {
      onSelectCaption?.(caption, selectedStyle);
      toast.success('Caption selected!');
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          Caption Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Style Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Select Style</p>
          <div className="grid grid-cols-3 gap-3">
            {styleOptions.map((style) => (
              <button
                key={style.value}
                onClick={() => setSelectedStyle(style.value)}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all',
                  selectedStyle === style.value
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-accent/50'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center mb-2',
                  selectedStyle === style.value
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary'
                )}>
                  {style.icon}
                </div>
                <p className="font-semibold text-sm">{style.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{style.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full"
          variant="accent"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? 'Generating...' : 'Generate Caption'}
        </Button>

        {/* Generated Caption */}
        <AnimatePresence>
          {caption && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{selectedStyle} style</Badge>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerate}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-1 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                className="resize-none font-mono text-sm"
              />
              {onSelectCaption && (
                <Button onClick={handleSelect} className="w-full">
                  Use This Caption
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
