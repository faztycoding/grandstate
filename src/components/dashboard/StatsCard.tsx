import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent';
}

export function StatsCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'card-elevated overflow-hidden',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'accent' && 'bg-accent text-accent-foreground'
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className={cn(
                'text-sm font-medium',
                variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
              )}>
                {title}
              </p>
              <p className="text-3xl font-bold mt-2">{value}</p>
              {subtitle && (
                <p className={cn(
                  'text-sm mt-1',
                  variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
                )}>
                  {subtitle}
                </p>
              )}
              {trend && (
                <div className={cn(
                  'flex items-center gap-1 mt-2 text-sm font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{trend.value}%</span>
                </div>
              )}
            </div>
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              variant === 'default' ? 'bg-primary/10 text-primary' : 'bg-white/20'
            )}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
