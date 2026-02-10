# HomePost Automation Backend

ระบบ Automation สำหรับโพสต์อสังหาริมทรัพย์บน Facebook Marketplace

## การติดตั้ง

```bash
cd backend
npm install
```

## การใช้งาน

### เริ่ม Server
```bash
npm run dev
```

Server จะรันที่ `http://localhost:3001`

## ฟีเจอร์หลัก

### 1. Facebook Marketplace Automation
- เปิด Browser และ Navigate ไป Facebook Marketplace
- เลือกประเภท "บ้านสำหรับขายหรือเช่า"
- กรอกฟอร์มอัตโนมัติ (รูปภาพ, รายละเอียด, ราคา, ที่ตั้ง)
- กดถัดไปอัตโนมัติ
- เลือกกลุ่มสำหรับโพสต์

### 2. ระบบป้องกันโพสต์ซ้ำ (Duplicate Prevention)
- **บันทึกประวัติการโพสต์**: เก็บข้อมูลว่า property ไหนโพสต์ไปกลุ่มไหนเมื่อไหร่
- **Cooldown Period**: กำหนดได้ว่าต้องรอกี่ชั่วโมงถึงจะโพสต์ซ้ำกลุ่มเดิมได้
- **Smart Selection**: เลือกกลุ่มอัตโนมัติโดยให้ความสำคัญกลุ่มที่ยังไม่เคยโพสต์

## API Endpoints

### Automation Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/start` | เปิด Browser |
| POST | `/api/automation/stop` | ปิด Browser |
| POST | `/api/automation/navigate-marketplace` | ไปหน้า Marketplace |
| POST | `/api/automation/create-property-listing` | เลือกประเภท "บ้านสำหรับขายหรือเช่า" |
| POST | `/api/automation/fill-form` | กรอกฟอร์ม |
| POST | `/api/automation/click-next` | กดถัดไป |
| POST | `/api/automation/select-groups` | เลือกกลุ่ม |
| POST | `/api/automation/post` | โพสต์ |
| POST | `/api/automation/full-flow` | ทำทุกอย่างอัตโนมัติ |

### Posting History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posting-history` | ดูประวัติทั้งหมด |
| GET | `/api/posting-history/:propertyId` | ดูประวัติของ property |
| GET | `/api/available-groups/:propertyId` | ดูกลุ่มที่สามารถโพสต์ได้ |

## Logic ป้องกันโพสต์ซ้ำ

```javascript
// 1. เก็บประวัติการโพสต์
postingTracker.recordPosting(propertyId, groupId);

// 2. ตรวจสอบว่าโพสต์ได้หรือยัง
const canPost = postingTracker.canPostToGroup(propertyId, groupId, cooldownHours);

// 3. กรองกลุ่มที่โพสต์ได้
const availableGroups = postingTracker.filterAvailableGroups(propertyId, allGroupIds, cooldownHours);

// 4. Smart Selection - เลือกกลุ่มอัตโนมัติ
const selectedGroups = postingTracker.smartSelectGroups(propertyId, allGroupIds, maxGroups, {
  cooldownHours: 24,        // รอ 24 ชม. ถึงจะโพสต์ซ้ำได้
  preferUnposted: true,     // ให้ความสำคัญกลุ่มที่ยังไม่เคยโพสต์
  rotateDaily: true,        // หมุนเวียนกลุ่มในแต่ละวัน
});
```

## โครงสร้างไฟล์

```
backend/
├── src/
│   ├── index.js                    # Express server
│   └── services/
│       ├── facebookAutomation.js   # Puppeteer automation
│       └── postingTracker.js       # ระบบติดตามการโพสต์
├── data/
│   └── posting-history.json        # ไฟล์เก็บประวัติ
├── chrome-data/                    # Browser session (เก็บ login)
└── package.json
```

## หมายเหตุ

1. **Login Facebook**: ครั้งแรกที่ใช้งาน ต้อง Login Facebook ใน Browser ที่เปิดขึ้นมา (Session จะถูกเก็บไว้ใน `chrome-data/`)

2. **รูปภาพ**: ระบบรองรับการอัพโหลดรูปภาพแบบ:
   - Base64 data URL
   - File path

3. **Facebook Rate Limit**: ระวังเรื่องการโพสต์บ่อยเกินไป Facebook อาจ block account

## ตัวอย่างการใช้งาน Full Flow

```javascript
// เรียก API full-flow
fetch('http://localhost:3001/api/automation/full-flow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    property: {
      id: 'prop-1',
      title: 'คอนโดสวย ใจกลางเมือง',
      price: 2500000,
      location: 'สุขุมวิท',
      district: 'วัฒนา',
      province: 'กรุงเทพ',
      size: 45,
      bedrooms: 2,
      bathrooms: 1,
      type: 'condo',
      listingType: 'sale',
      contactPhone: '0812345678',
    },
    images: ['path/to/image1.jpg', 'path/to/image2.jpg'],
    groupSelection: {
      groupIds: ['group-1', 'group-2', 'group-3'],
      preventDuplicates: true,
      cooldownHours: 24,
    },
  }),
});
```
