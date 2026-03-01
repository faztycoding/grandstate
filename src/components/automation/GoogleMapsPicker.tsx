import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MapPin, ExternalLink, Navigation, Loader2, CheckCircle2, Search, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

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

const DEFAULT_COORDS = { lat: 13.7563, lng: 100.5018 };
const MARKER_ICON = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

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

const isShortMapsUrl = (url: string): boolean => {
  return url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');
};

const resolveShortUrl = async (url: string): Promise<string> => {
  try {
    const res = await fetch('/api/maps/resolve-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.success && data.resolvedUrl) {
      return data.resolvedUrl;
    }
  } catch (e) {
    console.error('Failed to resolve short URL:', e);
  }
  return url;
};

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapViewportSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);

  return null;
}

export function GoogleMapsPicker({ value, onChange, onLocationSelect, className }: GoogleMapsPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  const parsedCoordsFromValue = useMemo(() => extractCoordsFromLink(value), [value]);

  useEffect(() => {
    if (!value?.trim()) {
      setSelectedLocation(null);
      return;
    }

    if (parsedCoordsFromValue) {
      setSelectedLocation(parsedCoordsFromValue);
    }
  }, [value, parsedCoordsFromValue]);

  const generateGoogleMapsLink = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
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

  const handleLinkChange = async (link: string, forceResolve = false) => {
    onChange(link);

    // For short URLs, resolve them first
    let resolvedLink = link;
    if (isShortMapsUrl(link) && (forceResolve || link.length > 10)) {
      setIsResolvingUrl(true);
      toast.loading('กำลังแปลงลิงค์...', { id: 'resolve-url' });
      resolvedLink = await resolveShortUrl(link);
      setIsResolvingUrl(false);

      if (resolvedLink !== link) {
        onChange(resolvedLink);
      }
    }

    const coords = extractCoordsFromLink(resolvedLink);
    if (coords) {
      setSelectedLocation(coords);
      toast.success('พบพิกัดจากลิงค์!', { id: 'resolve-url' });
      const addrData = await reverseGeocode(coords.lat, coords.lng);
      onLocationSelect?.({
        lat: coords.lat,
        lng: coords.lng,
        address: addrData.address || '',
        district: addrData.district || '',
        province: addrData.province || '',
        displayName: addrData.displayName || '',
      });
    } else if (isShortMapsUrl(link) && resolvedLink === link) {
      toast.error('ไม่สามารถดึงพิกัดจากลิงค์นี้ได้ กรุณาลองใหม่', { id: 'resolve-url' });
    }
  };

  const applyCoordinates = async (
    lat: number,
    lng: number,
    options?: { skipLinkUpdate?: boolean }
  ) => {
    setSelectedLocation({ lat, lng });
    if (!options?.skipLinkUpdate) {
      onChange(generateGoogleMapsLink(lat, lng));
    }

    const addrData = await reverseGeocode(lat, lng);
    onLocationSelect?.({
      lat,
      lng,
      address: addrData.address || '',
      district: addrData.district || '',
      province: addrData.province || '',
      displayName: addrData.displayName || '',
    });
  };

  const handleMapPick = (lat: number, lng: number) => {
    void applyCoordinates(lat, lng);
  };

  const openGoogleMaps = () => {
    const coords = selectedLocation || parsedCoordsFromValue || DEFAULT_COORDS;
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
        await applyCoordinates(latitude, longitude);
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
        onChange(generateGoogleMapsLink(coords.lat, coords.lng));

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

  const activeLocation = selectedLocation || parsedCoordsFromValue;
  const mapCenter = useMemo<[number, number]>(() => {
    const coords = activeLocation || DEFAULT_COORDS;
    return [coords.lat, coords.lng];
  }, [activeLocation]);

  const mapZoom = activeLocation ? 16 : 11;

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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (value.trim()) handleLinkChange(value.trim(), true);
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (pasted && isShortMapsUrl(pasted)) {
              e.preventDefault();
              handleLinkChange(pasted.trim(), true);
            }
          }}
          placeholder="วาง Google Maps ลิงค์ หรือ goo.gl ลิงค์แล้วกด Enter"
          className="h-10 border-gray-200 focus:border-amber-500 flex-1 text-xs"
          disabled={isResolvingUrl}
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

      {/* Interactive Map — click anywhere to drop a pin */}
      <Card className="overflow-hidden border border-gray-200">
        <div className="relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            className="h-[200px] w-full"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onPick={handleMapPick} />
            <MapViewportSync center={mapCenter} zoom={mapZoom} />
            {activeLocation && (
              <Marker
                position={[activeLocation.lat, activeLocation.lng]}
                icon={MARKER_ICON}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target as L.Marker;
                    const pos = marker.getLatLng();
                    void applyCoordinates(pos.lat, pos.lng);
                  },
                }}
              />
            )}
          </MapContainer>

          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-[11px] flex items-center gap-1 shadow-sm">
            <MousePointerClick className="w-3 h-3 text-blue-600" />
            คลิกแผนที่เพื่อปักหมุด
          </div>

          {activeLocation && (
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <MapPin className="w-3 h-3 text-red-500" />
              {activeLocation.lat.toFixed(6)}, {activeLocation.lng.toFixed(6)}
            </div>
          )}
        </div>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Tip: คลิกบนแผนที่เพื่อปักหมุด หรือจับหมุดลากเพื่อปรับตำแหน่งให้เป๊ะ
      </p>
    </div>
  );
}
