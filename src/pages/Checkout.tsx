import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    CreditCard,
    QrCode,
    Shield,
    Check,
    Loader2,
    Crown,
    Star,
    ArrowLeft,
    Clock,
    Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    loadOmiseScript,
    createCardToken,
    createPromptPaySource,
    PACKAGE_PRICES,
    PackageId
} from '@/lib/omise';
import { supabase } from '@/lib/supabase';

type PaymentMethod = 'promptpay' | 'card';

interface CardForm {
    name: string;
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
}

export default function Checkout() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const packageId = (searchParams.get('package') as PackageId) || 'agent';

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('promptpay');
    const [isLoading, setIsLoading] = useState(false);
    const [isOmiseLoaded, setIsOmiseLoaded] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [chargeId, setChargeId] = useState<string | null>(null);

    const [cardForm, setCardForm] = useState<CardForm>({
        name: '',
        number: '',
        expMonth: '',
        expYear: '',
        cvc: '',
    });

    const packageInfo = PACKAGE_PRICES[packageId] || PACKAGE_PRICES.agent;
    const priceDisplay = (packageInfo.amount / 100).toLocaleString();

    useEffect(() => {
        loadOmiseScript()
            .then(() => setIsOmiseLoaded(true))
            .catch(() => toast.error('ไม่สามารถโหลด Omise ได้'));
    }, []);

    // Poll for payment status if we have a charge ID
    useEffect(() => {
        if (!chargeId) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/payment/status/${chargeId}`);
                const data = await response.json();

                if (data.status === 'successful') {
                    clearInterval(pollInterval);
                    toast.success('ชำระเงินสำเร็จ!');
                    // Store license info and redirect
                    localStorage.setItem('pending_license', JSON.stringify({
                        chargeId,
                        package: packageId,
                        timestamp: Date.now()
                    }));
                    navigate('/auth?payment=success');
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    toast.error('การชำระเงินล้มเหลว');
                    setQrCodeUrl(null);
                    setChargeId(null);
                }
            } catch (error) {
                // Silently continue polling
            }
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [chargeId, packageId, navigate]);

    const handlePromptPayPayment = async () => {
        if (!isOmiseLoaded) {
            toast.error('กรุณารอสักครู่...');
            return;
        }

        setIsLoading(true);
        try {
            // Create PromptPay source
            const sourceId = await createPromptPaySource(packageInfo.amount);

            // Send to backend to create charge
            const response = await fetch('/api/payment/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: sourceId,
                    amount: packageInfo.amount,
                    currency: packageInfo.currency,
                    package: packageId,
                    description: `Grand$tate ${packageInfo.name} - 1 เดือน`,
                }),
            });

            const data = await response.json();

            if (data.success && data.qrCodeUrl) {
                setQrCodeUrl(data.qrCodeUrl);
                setChargeId(data.chargeId);
                toast.info('สแกน QR Code เพื่อชำระเงิน');
            } else {
                throw new Error(data.error || 'ไม่สามารถสร้าง QR Code ได้');
            }
        } catch (error: any) {
            toast.error(error.message || 'เกิดข้อผิดพลาด');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCardPayment = async () => {
        if (!isOmiseLoaded) {
            toast.error('กรุณารอสักครู่...');
            return;
        }

        // Validate form
        if (!cardForm.name || !cardForm.number || !cardForm.expMonth || !cardForm.expYear || !cardForm.cvc) {
            toast.error('กรุณากรอกข้อมูลบัตรให้ครบ');
            return;
        }

        setIsLoading(true);
        try {
            // Create card token
            const token = await createCardToken({
                name: cardForm.name,
                number: cardForm.number.replace(/\s/g, ''),
                expiration_month: cardForm.expMonth,
                expiration_year: cardForm.expYear,
                security_code: cardForm.cvc,
            });

            // Send to backend to create charge
            const response = await fetch('/api/payment/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    amount: packageInfo.amount,
                    currency: packageInfo.currency,
                    package: packageId,
                    description: `Grand$tate ${packageInfo.name} - 1 เดือน`,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('ชำระเงินสำเร็จ!');
                localStorage.setItem('pending_license', JSON.stringify({
                    chargeId: data.chargeId,
                    package: packageId,
                    timestamp: Date.now()
                }));
                navigate('/auth?payment=success');
            } else {
                throw new Error(data.error || 'การชำระเงินล้มเหลว');
            }
        } catch (error: any) {
            toast.error(error.message || 'เกิดข้อผิดพลาด');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
            <div className="max-w-lg mx-auto">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    onClick={() => navigate('/pricing')}
                    className="mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    กลับไปหน้าแพ็คเกจ
                </Button>

                {/* Package Summary */}
                <Card className="mb-6 border-2 border-accent/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                packageId === 'elite' ? 'bg-purple-500' : 'bg-amber-500'
                            )}>
                                {packageId === 'elite' ? (
                                    <Crown className="w-6 h-6 text-white" />
                                ) : (
                                    <Star className="w-6 h-6 text-white" />
                                )}
                            </div>
                            <div>
                                <CardTitle>{packageInfo.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{packageInfo.description}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>30 วัน</span>
                            </div>
                            <div className="text-2xl font-bold">
                                ฿{priceDisplay}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Methods */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-green-500" />
                            เลือกวิธีชำระเงิน
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Method Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentMethod('promptpay')}
                                className={cn(
                                    'p-4 rounded-xl border-2 transition-all',
                                    paymentMethod === 'promptpay'
                                        ? 'border-accent bg-accent/10'
                                        : 'border-border hover:border-accent/50'
                                )}
                            >
                                <QrCode className={cn(
                                    'w-8 h-8 mx-auto mb-2',
                                    paymentMethod === 'promptpay' ? 'text-accent' : 'text-muted-foreground'
                                )} />
                                <div className="font-medium">PromptPay</div>
                                <div className="text-xs text-muted-foreground">สแกน QR</div>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={cn(
                                    'p-4 rounded-xl border-2 transition-all',
                                    paymentMethod === 'card'
                                        ? 'border-accent bg-accent/10'
                                        : 'border-border hover:border-accent/50'
                                )}
                            >
                                <CreditCard className={cn(
                                    'w-8 h-8 mx-auto mb-2',
                                    paymentMethod === 'card' ? 'text-accent' : 'text-muted-foreground'
                                )} />
                                <div className="font-medium">บัตรเครดิต</div>
                                <div className="text-xs text-muted-foreground">Visa, Mastercard</div>
                            </button>
                        </div>

                        {/* PromptPay Section */}
                        {paymentMethod === 'promptpay' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                {qrCodeUrl ? (
                                    <div className="text-center space-y-4">
                                        <div className="bg-white p-4 rounded-xl inline-block">
                                            <img
                                                src={qrCodeUrl}
                                                alt="PromptPay QR Code"
                                                className="w-48 h-48"
                                            />
                                        </div>
                                        <div className="flex items-center justify-center gap-2 text-amber-600">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>รอการชำระเงิน...</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            สแกน QR Code ด้วยแอปธนาคารของคุณ
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <div className="p-8 bg-muted/50 rounded-xl">
                                            <Smartphone className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                            <p className="text-sm text-muted-foreground">
                                                กดปุ่มด้านล่างเพื่อสร้าง QR Code<br />
                                                สำหรับสแกนจ่ายด้วย PromptPay
                                            </p>
                                        </div>
                                        <Button
                                            className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600"
                                            onClick={handlePromptPayPayment}
                                            disabled={isLoading || !isOmiseLoaded}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    กำลังสร้าง QR...
                                                </>
                                            ) : (
                                                <>
                                                    <QrCode className="w-4 h-4 mr-2" />
                                                    สร้าง QR Code (฿{priceDisplay})
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Credit Card Section */}
                        {paymentMethod === 'card' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <div className="space-y-3">
                                    <div>
                                        <Label>ชื่อบนบัตร</Label>
                                        <Input
                                            placeholder="JOHN DOE"
                                            value={cardForm.name}
                                            onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div>
                                        <Label>หมายเลขบัตร</Label>
                                        <Input
                                            placeholder="4242 4242 4242 4242"
                                            value={cardForm.number}
                                            onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
                                            maxLength={19}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <Label>เดือน</Label>
                                            <Input
                                                placeholder="MM"
                                                value={cardForm.expMonth}
                                                onChange={(e) => setCardForm({ ...cardForm, expMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                                                maxLength={2}
                                            />
                                        </div>
                                        <div>
                                            <Label>ปี</Label>
                                            <Input
                                                placeholder="YY"
                                                value={cardForm.expYear}
                                                onChange={(e) => setCardForm({ ...cardForm, expYear: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                                                maxLength={2}
                                            />
                                        </div>
                                        <div>
                                            <Label>CVV</Label>
                                            <Input
                                                placeholder="123"
                                                type="password"
                                                value={cardForm.cvc}
                                                onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                                maxLength={4}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500"
                                    onClick={handleCardPayment}
                                    disabled={isLoading || !isOmiseLoaded}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            กำลังดำเนินการ...
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            ชำระเงิน ฿{priceDisplay}
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        )}

                        {/* Security Badge */}
                        <div className="flex items-center justify-center gap-2 pt-4 text-sm text-muted-foreground">
                            <Shield className="w-4 h-4 text-green-500" />
                            <span>ข้อมูลถูกเข้ารหัสด้วย SSL 256-bit</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Test Mode Notice */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                    🧪 Test Mode - ใช้บัตร 4242 4242 4242 4242 ทดสอบได้
                </p>
            </div>
        </div>
    );
}
