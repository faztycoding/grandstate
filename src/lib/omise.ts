// Omise Configuration
export const OMISE_PUBLIC_KEY = import.meta.env.VITE_OMISE_PUBLIC_KEY || 'pkey_test_66n8r6y5wsyot8nw3wt';

// Package prices in satang (1 THB = 100 satang)
export const PACKAGE_PRICES = {
    agent: {
        amount: 139000, // 1,390 THB
        currency: 'thb',
        name: 'Top Agent',
        description: '300 โพสต์/วัน, 300 กลุ่ม, ไม่จำกัดสินทรัพย์',
        durationDays: 30,
    },
    elite: {
        amount: 299000, // 2,990 THB
        currency: 'thb',
        name: 'Elite',
        description: '750 โพสต์/วัน, 750 กลุ่ม, ไม่จำกัดสินทรัพย์',
        durationDays: 30,
    },
} as const;

export type PackageId = keyof typeof PACKAGE_PRICES;

// Load Omise.js script
export function loadOmiseScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.Omise) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.omise.co/omise.js';
        script.onload = () => {
            window.Omise.setPublicKey(OMISE_PUBLIC_KEY);
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Create token from card
export function createCardToken(card: {
    name: string;
    number: string;
    expiration_month: string;
    expiration_year: string;
    security_code: string;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        window.Omise.createToken('card', card, (statusCode: number, response: any) => {
            if (statusCode === 200) {
                resolve(response.id);
            } else {
                reject(new Error(response.message || 'Failed to create token'));
            }
        });
    });
}

// Create PromptPay source
export function createPromptPaySource(amount: number): Promise<string> {
    return new Promise((resolve, reject) => {
        window.Omise.createSource('promptpay', { amount, currency: 'thb' }, (statusCode: number, response: any) => {
            if (statusCode === 200) {
                resolve(response.id);
            } else {
                reject(new Error(response.message || 'Failed to create source'));
            }
        });
    });
}

// Declare Omise on window
declare global {
    interface Window {
        Omise: {
            setPublicKey: (key: string) => void;
            createToken: (type: string, data: any, callback: (status: number, response: any) => void) => void;
            createSource: (type: string, data: any, callback: (status: number, response: any) => void) => void;
        };
    }
}
