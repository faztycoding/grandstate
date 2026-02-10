import { Property } from '@/types/property';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bed, Bath, Maximize, MapPin, MoreVertical, Pencil, Trash2, Zap, Image as ImageIcon } from 'lucide-react';
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
}

const formatPrice = (price: number, listingType: 'sale' | 'rent') => {
  if (price >= 1000000) {
    return `฿${(price / 1000000).toFixed(1)}M${listingType === 'rent' ? '/ด.' : ''}`;
  }
  return `฿${price.toLocaleString()}${listingType === 'rent' ? '/ด.' : ''}`;
};


export function PropertyCard({ property, onEdit, onDelete, onPost, onPreview }: PropertyCardProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="group overflow-hidden card-elevated hover:shadow-card-hover transition-all duration-300 cursor-pointer"
        onClick={() => onPreview?.(property)}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden property-card-image">
          {property.images[0] ? (
            <img
              src={property.images[0]}
              alt={property.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground opacity-50" />
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
