import { Property } from '@/types/property';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bed, Bath, Maximize, MapPin, MoreVertical, Pencil, Trash2, Zap, Image as ImageIcon, Ban, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';

interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void;
  onDelete?: (property: Property) => void;
  onPost?: (property: Property) => void;
  onPreview?: (property: Property) => void;
  onToggleSold?: (property: Property, isSold: boolean) => void;
}

const formatPrice = (price: number, listingType: 'sale' | 'rent') => {
  if (price >= 1000000) {
    return `฿${(price / 1000000).toFixed(1)}M${listingType === 'rent' ? '/ด.' : ''}`;
  }
  return `฿${price.toLocaleString()}${listingType === 'rent' ? '/ด.' : ''}`;
};


export function PropertyCard({ property, onEdit, onDelete, onPost, onPreview, onToggleSold }: PropertyCardProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="group overflow-hidden card-elevated card-hover-lift hover:shadow-card-hover transition-all duration-300 cursor-pointer"
        onClick={() => onPreview?.(property)}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden property-card-image">
          {property.images[0] ? (
            <img
              src={property.images[0]}
              alt={property.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground opacity-50" />
            </div>
          )}

          {/* ═══ SOLD OVERLAY ═══ */}
          {property.isSold && (
            <div className="absolute inset-0 z-10 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
              <motion.div
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="px-5 py-3 border-[3px] border-red-500 rounded-xl text-center select-none"
                style={{ transform: 'rotate(-15deg)', background: 'rgba(255,255,255,0.08)', boxShadow: '0 0 24px rgba(239,68,68,0.45)' }}
              >
                <p className="text-red-500 font-black text-2xl tracking-[0.08em] uppercase leading-tight">ปิดการขายแล้ว</p>
                <p className="text-red-400 font-semibold text-xs tracking-widest mt-0.5">รายการนี้ถูกขายแล้ว</p>
              </motion.div>
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge
              variant="secondary"
              className={cn(
                'backdrop-blur-sm font-semibold',
                property.listingType === 'sale'
                  ? 'bg-primary/90 text-primary-foreground'
                  : 'bg-accent/90 text-accent-foreground'
              )}
            >
              {property.listingType === 'sale' ? t.properties.forSale : t.properties.forRent}
            </Badge>
            <Badge variant="secondary" className="backdrop-blur-sm bg-background/80">
              {(t.properties as any)[property.type] || property.type}
            </Badge>
          </div>
          <div className="absolute top-3 right-3 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-background/90 backdrop-blur-sm hover:bg-background shadow-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100]" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem 
                  className="cursor-pointer hover:bg-accent"
                  onSelect={(e) => { e.stopPropagation(); onEdit?.(property); }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  {t.common.edit}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer hover:bg-accent"
                  onSelect={(e) => { e.stopPropagation(); onPost?.(property); }}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {t.common.goToAutomation}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn('cursor-pointer', property.isSold ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-orange-500 hover:bg-orange-500/10')}
                  onSelect={(e) => { e.stopPropagation(); onToggleSold?.(property, !property.isSold); }}
                >
                  {property.isSold
                    ? <><RefreshCw className="w-4 h-4 mr-2" />เปิดการขายอีกครั้ง</>
                    : <><Ban className="w-4 h-4 mr-2" />ปิดการขาย</>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive cursor-pointer hover:bg-destructive/10"
                  onSelect={(e) => { e.stopPropagation(); onDelete?.(property); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t.common.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Price badge */}
          <div className="absolute bottom-3 right-3">
            <Badge className="bg-background/95 text-foreground backdrop-blur-sm text-base font-bold px-3 py-1.5">
              {formatPrice(property.price, property.listingType)}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-lg line-clamp-1 mb-1">{property.title}</h3>
          <div className="flex items-center text-muted-foreground text-sm mb-3">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0 text-accent" />
            <span className="line-clamp-1">{property.location}, {property.district}</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Bed className="w-4 h-4" />
              <span>{property.bedrooms}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4" />
              <span>{property.bathrooms}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Maximize className="w-4 h-4" />
              <span>{property.size}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
