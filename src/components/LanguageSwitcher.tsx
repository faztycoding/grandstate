import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ heroMode = false }: { heroMode?: boolean }) {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative',
            heroMode && 'text-white/85 hover:text-white hover:bg-white/10'
          )}
        >
          <Languages className={cn('w-5 h-5', heroMode && 'text-white')} />
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 text-[10px] font-bold rounded px-1',
              heroMode
                ? 'bg-white/15 text-white border border-white/20 backdrop-blur-md'
                : 'bg-primary text-primary-foreground'
            )}
          >
            {language.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem 
          onClick={() => setLanguage('th')}
          className={cn("cursor-pointer", language === 'th' && "bg-accent/10")}
        >
          <span className="text-lg mr-2">🇹🇭</span>
          <span className="flex-1">ภาษาไทย</span>
          {language === 'th' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage('en')}
          className={cn("cursor-pointer", language === 'en' && "bg-accent/10")}
        >
          <span className="text-lg mr-2">🇺🇸</span>
          <span className="flex-1">English</span>
          {language === 'en' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
