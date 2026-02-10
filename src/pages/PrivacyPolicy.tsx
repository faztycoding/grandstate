
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-8"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    ย้อนกลับ
                </Button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="prose dark:prose-invert max-w-none"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="w-10 h-10 text-primary" />
                        <h1 className="text-4xl font-bold m-0">นโยบายความเป็นส่วนตัว (Privacy Policy)</h1>
                    </div>

                    <p className="lead text-xl text-muted-foreground">
                        มีผลบังคับใช้ตั้งแต่วันที่ 1 มกราคม 2567
                    </p>

                    <div className="bg-card p-6 rounded-lg border my-8">
                        <h3>1. ข้อมูลที่เราเก็บรวบรวม</h3>
                        <p>เราเก็บรวบรวมข้อมูลเท่าที่จำเป็นเพื่อให้บริการแก่ท่าน ได้แก่:</p>
                        <ul>
                            <li><strong>ข้อมูลส่วนตัว:</strong> ชื่อ, อีเมล, เบอร์โทรศัพท์ (เมื่อท่านสมัครสมาชิกหรือสั่งซื้อ)</li>
                            <li><strong>ข้อมูลการใช้งาน:</strong> ประวัติการเข้าสู่ระบบ, การใช้งานฟีเจอร์ต่างๆ</li>
                            <li><strong>ข้อมูลอุปกรณ์:</strong> IP Address, ประเภทอุปกรณ์ (เพื่อจัดการ License Key)</li>
                        </ul>
                    </div>

                    <h3>2. การใช้ข้อมูลของท่าน</h3>
                    <p>เราใช้ข้อมูลของท่านเพื่อ:</p>
                    <ul>
                        <li>ยืนยันตัวตนและการสั่งซื้อ (License Verification)</li>
                        <li>ปรับปรุงประสิทธิภาพของซอฟต์แวร์</li>
                        <li>ติดต่อสื่อสารและแจ้งข่าวสารที่สำคัญ</li>
                    </ul>

                    <h3>3. การเปิดเผยข้อมูล</h3>
                    <p>เรา<strong>ไม่ขาย</strong>และไม่เปิดเผยข้อมูลส่วนตัวของท่านแก่บุคคลภายนอก ยกเว้น:</p>
                    <ul>
                        <li>ผู้ให้บริการชำระเงิน (Payment Gateway) เพื่อประมวลผลธุรกรรม</li>
                        <li>การปฏิบัติตามกฎหมายหรือคำสั่งศาล</li>
                    </ul>

                    <h3>4. ความปลอดภัยของข้อมูล</h3>
                    <p>เราใช้มาตรการรักษาความปลอดภัยตามมาตรฐานสากล (SSL/TLS Encryption) เพื่อปกป้องข้อมูลของท่านจากการเข้าถึงโดยไม่ได้รับอนุญาต</p>

                    <h3>5. การลบข้อมูล</h3>
                    <p>ท่านสามารถร้องขอให้ลบข้อมูลส่วนตัวของท่านออกจากระบบได้ตลอดเวลา โดยติดต่อเราผ่านช่องทางที่ระบุไว้</p>

                    <hr className="my-8" />

                    <h3>ติดต่อเรา</h3>
                    <p>หากท่านมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว สามารถติดต่อได้ที่:</p>
                    <ul>
                        <li><strong>Email:</strong> support@grandstate.co</li>
                        <li><strong>Line OA:</strong> @grandstate</li>
                    </ul>
                </motion.div>
            </div>
        </div>
    );
}
