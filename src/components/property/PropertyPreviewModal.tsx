import { Property } from '@/types/property';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bed,
  Bath,
  Maximize,
  MapPin,
  Phone,
  MessageSquare,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  Copy,
  Images,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

interface PropertyPreviewModalProps {
  property: Property | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (property: Property) => void;
  onPost?: (property: Property) => void;
}

const formatPrice = (price: number, listingType: 'sale' | 'rent', notSpecified = 'N/A') => {
  if (!price) return notSpecified;
  if (price >= 1000000) {
    return `฿${(price / 1000000).toFixed(1)}M${listingType === 'rent' ? '/ด.' : ''}`;
  }
  return `฿${price.toLocaleString()}${listingType === 'rent' ? '/ด.' : ''}`;
};

const propertyTypeIcons: Record<string, string> = {
  condo: '🏢',
  house: '🏠',
  townhouse: '🏘️',
  land: '🏞️',
  apartment: '🏬',
  commercial: '🏪',
};

export function PropertyPreviewModal({ property, open, onClose, onEdit, onPost }: PropertyPreviewModalProps) {
  const { t } = useLanguage();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllImages, setShowAllImages] = useState(false);

  // Reset image index when property changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setShowAllImages(false);
  }, [property?.id]);

  if (!property) return null;

  const images = property.images || [];
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;
  const locationText = [property.location, property.district, property.province].filter(Boolean).join(', ') || t.common.noData;

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const copyContact = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`คัดลอก${label}แล้ว`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0">
        <div className="overflow-y-auto max-h-[90vh]">
          {/* === IMAGE SECTION === */}
          <div className="relative h-[280px] bg-muted overflow-hidden">
            {hasImages ? (
              <>
                <img
                  src={images[currentImageIndex]}
                  alt={`${property.title} - ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />

                {hasMultipleImages && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                    <button
                      onClick={() => setShowAllImages(!showAllImages)}
                      className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5"
                    >
                      <Images className="w-3.5 h-3.5" />
                      {t.common.viewAll} ({images.length})
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <span className="text-5xl block mb-2">🏠</span>
                  <p className="text-sm">{t.common.noData}</p>
                </div>
              </div>
            )}

            {/* Top Badges */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge className={cn(
                'font-semibold backdrop-blur-sm px-2.5 py-0.5',
                property.listingType === 'sale'
                  ? 'bg-primary/90 text-primary-foreground'
                  : 'bg-accent/90 text-accent-foreground'
              )}>
                {property.listingType === 'sale' ? t.properties.forSale : t.properties.forRent}
              </Badge>
              <Badge className="backdrop-blur-sm bg-background/80 px-2.5 py-0.5">
                {propertyTypeIcons[property.type]} {(t.properties as any)[property.type] || property.type}
              </Badge>
            </div>
          </div>

          {/* === THUMBNAIL GRID (toggle) === */}
          {showAllImages && images.length > 1 && (
            <div className="p-3 bg-muted/50 border-b">
              <div className="grid grid-cols-5 gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrentImageIndex(i); setShowAllImages(false); }}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      i === currentImageIndex ? "border-accent ring-2 ring-accent/30" : "border-transparent hover:border-accent/50"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === PROPERTY INFO === */}
          <div className="p-5 space-y-4">

            {/* Title + Price row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">{property.title || t.common.noData}</h2>
                <div className="flex items-center text-muted-foreground text-sm mt-1">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-accent flex-shrink-0" />
                  <span className="truncate">{locationText}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-accent">
                  {formatPrice(property.price, property.listingType, t.common.noData)}
                </p>
              </div>
            </div>

            {/* Key Stats - ALWAYS visible */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <Bed className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                <p className="text-xl font-bold">{property.bedrooms || 0}</p>
                <p className="text-xs text-muted-foreground">{t.properties.bedrooms}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800">
                <Bath className="w-5 h-5 mx-auto mb-1 text-cyan-600" />
                <p className="text-xl font-bold">{property.bathrooms || 0}</p>
                <p className="text-xs text-muted-foreground">{t.properties.bathrooms}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <Maximize className="w-5 h-5 mx-auto mb-1 text-green-600" />
                <p className="text-xl font-bold">{property.size || 0}</p>
                <p className="text-xs text-muted-foreground">{t.properties.size}</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h3 className="font-semibold">{t.properties.description}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {property.description || t.common.noData}
              </p>
            </div>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="font-semibold">{t.properties.amenities}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {property.amenities.map((amenity, i) => (
                    <Badge key={i} variant="secondary" className="px-2.5 py-1 text-xs">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Info */}
            {(property.contactName || property.contactPhone || property.contactLine) && (
              <div className="space-y-1.5">
                <h3 className="font-semibold">{t.properties.contact}</h3>
                <div className="p-3 rounded-xl bg-muted/50 space-y-1.5 text-sm">
                  {property.contactName && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{property.contactName}</span>
                    </div>
                  )}
                  {property.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{property.contactPhone}</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => copyContact(property.contactPhone, t.common.copyPhone)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {property.contactLine && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>LINE: {property.contactLine}</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => copyContact(property.contactLine!, 'LINE ID')}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {t.common.createdAt} {new Date(property.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-1">
              {onEdit && (
                <Button variant="outline" className="flex-1" onClick={() => {
                  const p = property;
                  onClose();
                  setTimeout(() => onEdit(p), 150);
                }}>
                  {t.common.editData}
                </Button>
              )}
              {onPost && (
                <Button variant="accent" className="flex-1" onClick={() => {
                  const p = property;
                  onClose();
                  setTimeout(() => onPost(p), 150);
                }}>
                  <Zap className="w-4 h-4 mr-2" />
                  {t.common.goToAutomation}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
