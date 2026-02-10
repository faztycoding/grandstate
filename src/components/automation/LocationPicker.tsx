import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Clock, Search, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

// Thai provinces and popular areas data
const LOCATIONS = [
  // กรุงเทพและปริมณฑล
  { id: '1', name: 'กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'province' },
  { id: '2', name: 'สุขุมวิท, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '3', name: 'สาทร, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '4', name: 'ลาดพร้าว, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '5', name: 'บางนา, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '6', name: 'อ่อนนุช, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '7', name: 'พระราม 9, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '8', name: 'รัชดาภิเษก, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '9', name: 'ทองหล่อ, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '10', name: 'เอกมัย, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '11', name: 'อารีย์, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '12', name: 'สีลม, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '13', name: 'บางกะปิ, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '14', name: 'มีนบุรี, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  { id: '15', name: 'ดอนเมือง, กรุงเทพมหานคร', province: 'กรุงเทพมหานคร', type: 'area' },
  
  // ปริมณฑล
  { id: '20', name: 'นนทบุรี', province: 'นนทบุรี', type: 'province' },
  { id: '21', name: 'ปากเกร็ด, นนทบุรี', province: 'นนทบุรี', type: 'area' },
  { id: '22', name: 'บางใหญ่, นนทบุรี', province: 'นนทบุรี', type: 'area' },
  { id: '23', name: 'ปทุมธานี', province: 'ปทุมธานี', type: 'province' },
  { id: '24', name: 'รังสิต, ปทุมธานี', province: 'ปทุมธานี', type: 'area' },
  { id: '25', name: 'ลำลูกกา, ปทุมธานี', province: 'ปทุมธานี', type: 'area' },
  { id: '26', name: 'สมุทรปราการ', province: 'สมุทรปราการ', type: 'province' },
  { id: '27', name: 'บางพลี, สมุทรปราการ', province: 'สมุทรปราการ', type: 'area' },
  { id: '28', name: 'เมืองสมุทรปราการ', province: 'สมุทรปราการ', type: 'area' },
  
  // ภาคกลาง
  { id: '30', name: 'พระนครศรีอยุธยา', province: 'พระนครศรีอยุธยา', type: 'province' },
  { id: '31', name: 'นครปฐม', province: 'นครปฐม', type: 'province' },
  { id: '32', name: 'สมุทรสาคร', province: 'สมุทรสาคร', type: 'province' },
  
  // ภาคเหนือ
  { id: '40', name: 'เชียงใหม่', province: 'เชียงใหม่', type: 'province' },
  { id: '41', name: 'นิมมานเหมินท์, เชียงใหม่', province: 'เชียงใหม่', type: 'area' },
  { id: '42', name: 'สันทราย, เชียงใหม่', province: 'เชียงใหม่', type: 'area' },
  { id: '43', name: 'เชียงราย', province: 'เชียงราย', type: 'province' },
  { id: '44', name: 'ลำปาง', province: 'ลำปาง', type: 'province' },
  { id: '45', name: 'พิษณุโลก', province: 'พิษณุโลก', type: 'province' },
  
  // ภาคอีสาน
  { id: '50', name: 'ขอนแก่น', province: 'ขอนแก่น', type: 'province' },
  { id: '51', name: 'อุดรธานี', province: 'อุดรธานี', type: 'province' },
  { id: '52', name: 'นครราชสีมา (โคราช)', province: 'นครราชสีมา', type: 'province' },
  { id: '53', name: 'อุบลราชธานี', province: 'อุบลราชธานี', type: 'province' },
  
  // ภาคตะวันออก
  { id: '60', name: 'ชลบุรี', province: 'ชลบุรี', type: 'province' },
  { id: '61', name: 'พัทยา, ชลบุรี', province: 'ชลบุรี', type: 'area' },
  { id: '62', name: 'ศรีราชา, ชลบุรี', province: 'ชลบุรี', type: 'area' },
  { id: '63', name: 'บางแสน, ชลบุรี', province: 'ชลบุรี', type: 'area' },
  { id: '64', name: 'ระยอง', province: 'ระยอง', type: 'province' },
  { id: '65', name: 'จันทบุรี', province: 'จันทบุรี', type: 'province' },
  
  // ภาคใต้
  { id: '70', name: 'ภูเก็ต', province: 'ภูเก็ต', type: 'province' },
  { id: '71', name: 'ป่าตอง, ภูเก็ต', province: 'ภูเก็ต', type: 'area' },
  { id: '72', name: 'กะทู้, ภูเก็ต', province: 'ภูเก็ต', type: 'area' },
  { id: '73', name: 'สุราษฎร์ธานี', province: 'สุราษฎร์ธานี', type: 'province' },
  { id: '74', name: 'เกาะสมุย, สุราษฎร์ธานี', province: 'สุราษฎร์ธานี', type: 'area' },
  { id: '75', name: 'สงขลา', province: 'สงขลา', type: 'province' },
  { id: '76', name: 'หาดใหญ่, สงขลา', province: 'สงขลา', type: 'area' },
  { id: '77', name: 'กระบี่', province: 'กระบี่', type: 'province' },
  { id: '78', name: 'หัวหิน, ประจวบคีรีขันธ์', province: 'ประจวบคีรีขันธ์', type: 'area' },
];

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationPicker({
  value,
  onChange,
  placeholder = 'ที่ตั้ง',
  className,
}: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent locations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentLocations');
    if (saved) {
      setRecentLocations(JSON.parse(saved));
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter locations based on search
  const filteredLocations = searchQuery
    ? LOCATIONS.filter(
        loc =>
          loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.province.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : LOCATIONS;

  const handleSelect = (locationName: string) => {
    onChange(locationName);
    setSearchQuery('');
    setIsOpen(false);

    // Save to recent locations
    const newRecent = [locationName, ...recentLocations.filter(l => l !== locationName)].slice(0, 5);
    setRecentLocations(newRecent);
    localStorage.setItem('recentLocations', JSON.stringify(newRecent));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    if (!isOpen) setIsOpen(true);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // For demo, just set a location based on coords
          // In production, use reverse geocoding API
          const { latitude, longitude } = position.coords;
          const locationText = `พิกัด ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          handleSelect(locationText);
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Fallback to default
          handleSelect('กรุงเทพมหานคร');
        }
      );
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          ref={inputRef}
          value={value || searchQuery}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="border-0 bg-gray-50 h-12 pl-10 pr-10"
        />
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
          title="ใช้ตำแหน่งปัจจุบัน"
        >
          <Navigation className="w-4 h-4 text-blue-600" />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 overflow-hidden">
          <ScrollArea className="max-h-[300px]">
            {/* Current Location Option */}
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-600">ใช้ตำแหน่งปัจจุบัน</p>
                <p className="text-xs text-gray-500">เปิด GPS เพื่อค้นหาตำแหน่งของคุณ</p>
              </div>
            </button>

            {/* Recent Locations */}
            {recentLocations.length > 0 && !searchQuery && (
              <div className="py-2">
                <p className="px-4 py-1 text-xs text-gray-500 font-medium">ค้นหาล่าสุด</p>
                {recentLocations.map((loc, idx) => (
                  <button
                    key={`recent-${idx}`}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{loc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search Results */}
            <div className="py-2">
              {searchQuery && (
                <p className="px-4 py-1 text-xs text-gray-500 font-medium">
                  ผลการค้นหา ({filteredLocations.length})
                </p>
              )}
              {!searchQuery && (
                <p className="px-4 py-1 text-xs text-gray-500 font-medium">สถานที่ยอดนิยม</p>
              )}
              {filteredLocations.slice(0, 15).map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => handleSelect(location.name)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{location.name}</p>
                    {location.type === 'area' && (
                      <p className="text-xs text-gray-400">พื้นที่</p>
                    )}
                  </div>
                </button>
              ))}
              {filteredLocations.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">ไม่พบสถานที่ที่ค้นหา</p>
                  <p className="text-xs">ลองพิมพ์ชื่อจังหวัดหรือย่าน</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
