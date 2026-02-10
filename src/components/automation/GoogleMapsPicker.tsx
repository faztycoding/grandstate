import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MapPin, ExternalLink, Navigation, Loader2, CheckCircle2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface LocationData {
  lat: number;
  lng: number;
  address: string;      // ที่อยู่ / ซอย / ถนน
  district: string;     // เขต / อำเภอ
  province: string;     // จังหวัด
  displayName: string;  // ชื่อเต็ม
}

interface GoogleMapsPickerProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: LocationData) => void;
  className?: string;
}

export function GoogleMapsPicker({ value, onChange, onLocationSelect, className }: GoogleMapsPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const generateGoogleMapsLink = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const extractCoordsFromLink = (link: string): { lat: number; lng: number } | null => {
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /place\/.*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /maps\?.*?(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
      }
    }
    return null;
  };

  // Reverse geocode coords → structured address
  const reverseGeocode = async (lat: number, lng: number): Promise<Partial<LocationData>> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        { headers: { 'Accept-Language': 'th' } }
      );
      const data = await res.json();
      if (data?.address) {
        return parseNominatimAddress(data.address, data.display_name || '');
      }
    } catch {}
    return { address: '', district: '', province: '', displayName: '' };
  };

  // Parse Nominatim address object → our LocationData fields
  const parseNominatimAddress = (addr: any, displayName: string): Partial<LocationData> => {
    const road = addr.road || addr.pedestrian || addr.neighbourhood || '';
    const suburb = addr.suburb || addr.quarter || addr.village || '';
    const address = [road, suburb].filter(Boolean).join(', ');

    const district = addr.city_district || addr.county || addr.town || addr.city || '';
    const province = addr.state || addr.province || addr.city || '';

    return { address, district, province, displayName };
  };

  const handleLinkChange = async (link: string) => {
    onChange(link);
    const coords = extractCoordsFromLink(link);
    if (coords) {
      setSelectedLocation(coords);
      toast.success('พบพิกัดจากลิงค์!');
      const addrData = await reverseGeocode(coords.lat, coords.lng);
      onLocationSelect?.({
        lat: coords.lat,
        lng: coords.lng,
        address: addrData.address || '',
        district: addrData.district || '',
        province: addrData.province || '',
        displayName: addrData.displayName || '',
      });
    }
  };

  const openGoogleMaps = () => {
    const coords = selectedLocation || { lat: 13.7563, lng: 100.5018 };
    const url = `https://www.google.com/maps/@${coords.lat},${coords.lng},15z`;
    window.open(url, '_blank');
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedLocation({ lat: latitude, lng: longitude });
        const link = generateGoogleMapsLink(latitude, longitude);
        onChange(link);
        const addrData = await reverseGeocode(latitude, longitude);
        onLocationSelect?.({
          lat: latitude,
          lng: longitude,
          address: addrData.address || '',
          district: addrData.district || '',
          province: addrData.province || '',
          displayName: addrData.displayName || '',
        });
        setIsLocating(false);
        toast.success('ได้ตำแหน่งปัจจุบันแล้ว!');
      },
      (error) => {
        setIsLocating(false);
        console.error('Geolocation error:', error);
        toast.error('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Search location using free Nominatim API (OpenStreetMap)
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&countrycodes=th&limit=1`,
        { headers: { 'Accept-Language': 'th' } }
      );
      const data = await res.json();

      if (data.length > 0) {
        const result = data[0];
        const coords = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
        setSelectedLocation(coords);
        const link = generateGoogleMapsLink(coords.lat, coords.lng);
        onChange(link);

        // Extract structured address from search result
        let addrData: Partial<LocationData> = { address: '', district: '', province: '', displayName: result.display_name };
        if (result.address) {
          addrData = parseNominatimAddress(result.address, result.display_name);
        } else {
          // Fallback: reverse geocode for full address details
          addrData = await reverseGeocode(coords.lat, coords.lng);
        }

        onLocationSelect?.({
          lat: coords.lat,
          lng: coords.lng,
          address: addrData.address || '',
          district: addrData.district || '',
          province: addrData.province || '',
          displayName: addrData.displayName || result.display_name,
        });
        toast.success(`พบ: ${result.display_name.split(',')[0]}`);
      } else {
        toast.error('ไม่พบตำแหน่ง ลองค้นหาใหม่');
      }
    } catch (err) {
      toast.error('ค้นหาไม่สำเร็จ');
    } finally {
      setIsSearching(false);
    }
  };

  // Build OpenStreetMap embed URL (free, no API key needed)
  const getMapEmbedUrl = () => {
    if (!selectedLocation) return null;
    const { lat, lng } = selectedLocation;
    const bbox = `${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  };

  const embedUrl = getMapEmbedUrl();

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search by name */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchLocation(); } }}
            placeholder="ค้นหาสถานที่ เช่น สุขุมวิท 24, เซ็นทรัลลาดพร้าว..."
            className="h-10 pl-10 border-gray-200 focus:border-amber-500 flex-1"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3"
          onClick={searchLocation}
          disabled={isSearching}
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Link input + Actions */}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => handleLinkChange(e.target.value)}
          placeholder="หรือวาง Google Maps ลิงค์ที่นี่..."
          className="h-10 border-gray-200 focus:border-amber-500 flex-1 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3"
          onClick={getCurrentLocation}
          disabled={isLocating}
          title="ใช้ตำแหน่งปัจจุบัน"
        >
          {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3"
          onClick={openGoogleMaps}
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Maps
        </Button>
      </div>

      {/* Map Preview — OpenStreetMap (free, no key) */}
      {embedUrl && (
        <Card className="overflow-hidden border border-gray-200">
          <div className="relative">
            <iframe
              width="100%"
              height="200"
              style={{ border: 0 }}
              loading="lazy"
              src={embedUrl}
            />
            {selectedLocation && (
              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <MapPin className="w-3 h-3 text-red-500" />
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
