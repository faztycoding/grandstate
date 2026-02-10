import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemePalette {
  id: string;
  name: string;
  nameEn: string;
  preview: string[]; // 4 preview colors
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'navy-gold',
    name: 'Navy & Gold',
    nameEn: 'Navy & Gold',
    preview: ['#1e3a5f', '#f59e0b', '#e5e7eb', '#ffffff'],
    light: {
      '--primary': '217 71% 22%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '38 92% 50%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '217 71% 12%',
      '--sidebar-foreground': '210 40% 90%',
      '--sidebar-primary': '38 92% 50%',
      '--sidebar-accent': '217 71% 18%',
      '--sidebar-border': '217 50% 20%',
      '--sidebar-ring': '38 92% 50%',
      '--sidebar-muted': '217 50% 25%',
      '--ring': '217 71% 22%',
    },
    dark: {
      '--primary': '38 92% 50%',
      '--primary-foreground': '217 71% 12%',
      '--accent': '38 92% 50%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '217 71% 6%',
      '--sidebar-primary': '38 92% 50%',
      '--sidebar-accent': '217 71% 15%',
      '--sidebar-border': '217 50% 15%',
      '--sidebar-ring': '38 92% 50%',
      '--sidebar-muted': '217 50% 20%',
      '--ring': '38 92% 50%',
    },
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    nameEn: 'Ocean Teal',
    preview: ['#0d9488', '#f97316', '#e0f2fe', '#ffffff'],
    light: {
      '--primary': '173 58% 39%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '24 95% 53%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '173 58% 14%',
      '--sidebar-foreground': '170 40% 90%',
      '--sidebar-primary': '24 95% 53%',
      '--sidebar-accent': '173 50% 20%',
      '--sidebar-border': '173 40% 22%',
      '--sidebar-ring': '24 95% 53%',
      '--sidebar-muted': '173 40% 25%',
      '--ring': '173 58% 39%',
    },
    dark: {
      '--primary': '24 95% 53%',
      '--primary-foreground': '173 58% 10%',
      '--accent': '24 95% 53%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '173 58% 6%',
      '--sidebar-primary': '24 95% 53%',
      '--sidebar-accent': '173 50% 14%',
      '--sidebar-border': '173 40% 14%',
      '--sidebar-ring': '24 95% 53%',
      '--sidebar-muted': '173 40% 18%',
      '--ring': '24 95% 53%',
    },
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    nameEn: 'Royal Purple',
    preview: ['#6d28d9', '#ec4899', '#f3e8ff', '#ffffff'],
    light: {
      '--primary': '263 70% 50%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '330 81% 60%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '263 70% 14%',
      '--sidebar-foreground': '260 40% 90%',
      '--sidebar-primary': '330 81% 60%',
      '--sidebar-accent': '263 60% 22%',
      '--sidebar-border': '263 50% 22%',
      '--sidebar-ring': '330 81% 60%',
      '--sidebar-muted': '263 50% 25%',
      '--ring': '263 70% 50%',
    },
    dark: {
      '--primary': '330 81% 60%',
      '--primary-foreground': '263 70% 10%',
      '--accent': '330 81% 60%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '263 70% 6%',
      '--sidebar-primary': '330 81% 60%',
      '--sidebar-accent': '263 60% 15%',
      '--sidebar-border': '263 50% 15%',
      '--sidebar-ring': '330 81% 60%',
      '--sidebar-muted': '263 50% 20%',
      '--ring': '330 81% 60%',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest',
    nameEn: 'Forest',
    preview: ['#166534', '#ca8a04', '#dcfce7', '#ffffff'],
    light: {
      '--primary': '142 64% 24%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '45 93% 47%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '142 64% 10%',
      '--sidebar-foreground': '140 40% 90%',
      '--sidebar-primary': '45 93% 47%',
      '--sidebar-accent': '142 50% 16%',
      '--sidebar-border': '142 40% 18%',
      '--sidebar-ring': '45 93% 47%',
      '--sidebar-muted': '142 40% 20%',
      '--ring': '142 64% 24%',
    },
    dark: {
      '--primary': '45 93% 47%',
      '--primary-foreground': '142 64% 8%',
      '--accent': '45 93% 47%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '142 64% 5%',
      '--sidebar-primary': '45 93% 47%',
      '--sidebar-accent': '142 50% 12%',
      '--sidebar-border': '142 40% 12%',
      '--sidebar-ring': '45 93% 47%',
      '--sidebar-muted': '142 40% 16%',
      '--ring': '45 93% 47%',
    },
  },
  {
    id: 'slate-rose',
    name: 'Slate & Rose',
    nameEn: 'Slate & Rose',
    preview: ['#475569', '#e11d48', '#f1f5f9', '#ffffff'],
    light: {
      '--primary': '215 19% 35%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '347 77% 50%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '215 28% 12%',
      '--sidebar-foreground': '215 20% 90%',
      '--sidebar-primary': '347 77% 50%',
      '--sidebar-accent': '215 25% 18%',
      '--sidebar-border': '215 20% 20%',
      '--sidebar-ring': '347 77% 50%',
      '--sidebar-muted': '215 20% 22%',
      '--ring': '215 19% 35%',
    },
    dark: {
      '--primary': '347 77% 50%',
      '--primary-foreground': '215 28% 10%',
      '--accent': '347 77% 50%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '215 28% 6%',
      '--sidebar-primary': '347 77% 50%',
      '--sidebar-accent': '215 25% 14%',
      '--sidebar-border': '215 20% 14%',
      '--sidebar-ring': '347 77% 50%',
      '--sidebar-muted': '215 20% 18%',
      '--ring': '347 77% 50%',
    },
  },
  {
    id: 'midnight-electric',
    name: 'Midnight',
    nameEn: 'Midnight',
    preview: ['#1e293b', '#3b82f6', '#dbeafe', '#ffffff'],
    light: {
      '--primary': '217 33% 17%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '217 91% 60%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '217 33% 8%',
      '--sidebar-foreground': '215 20% 90%',
      '--sidebar-primary': '217 91% 60%',
      '--sidebar-accent': '217 30% 14%',
      '--sidebar-border': '217 25% 16%',
      '--sidebar-ring': '217 91% 60%',
      '--sidebar-muted': '217 25% 18%',
      '--ring': '217 33% 17%',
    },
    dark: {
      '--primary': '217 91% 60%',
      '--primary-foreground': '217 33% 8%',
      '--accent': '217 91% 60%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '217 33% 5%',
      '--sidebar-primary': '217 91% 60%',
      '--sidebar-accent': '217 30% 12%',
      '--sidebar-border': '217 25% 12%',
      '--sidebar-ring': '217 91% 60%',
      '--sidebar-muted': '217 25% 15%',
      '--ring': '217 91% 60%',
    },
  },
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    nameEn: 'Warm Earth',
    preview: ['#78350f', '#dc2626', '#fef3c7', '#ffffff'],
    light: {
      '--primary': '28 73% 26%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '0 72% 51%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '28 60% 10%',
      '--sidebar-foreground': '30 30% 90%',
      '--sidebar-primary': '0 72% 51%',
      '--sidebar-accent': '28 50% 16%',
      '--sidebar-border': '28 40% 18%',
      '--sidebar-ring': '0 72% 51%',
      '--sidebar-muted': '28 40% 20%',
      '--ring': '28 73% 26%',
    },
    dark: {
      '--primary': '0 72% 51%',
      '--primary-foreground': '28 60% 8%',
      '--accent': '0 72% 51%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '28 60% 5%',
      '--sidebar-primary': '0 72% 51%',
      '--sidebar-accent': '28 50% 12%',
      '--sidebar-border': '28 40% 12%',
      '--sidebar-ring': '0 72% 51%',
      '--sidebar-muted': '28 40% 16%',
      '--ring': '0 72% 51%',
    },
  },
  {
    id: 'luxury-black',
    name: 'Luxury Black',
    nameEn: 'Luxury Black',
    preview: ['#0a0a0a', '#d4af37', '#f5f5f5', '#ffffff'],
    light: {
      '--primary': '0 0% 4%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '46 65% 52%',
      '--accent-foreground': '0 0% 4%',
      '--sidebar-background': '0 0% 8%',
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': '46 65% 52%',
      '--sidebar-accent': '0 0% 15%',
      '--sidebar-border': '0 0% 20%',
      '--sidebar-ring': '46 65% 52%',
      '--sidebar-muted': '0 0% 25%',
      '--ring': '46 65% 52%',
    },
    dark: {
      '--primary': '46 65% 52%',
      '--primary-foreground': '0 0% 4%',
      '--accent': '46 65% 52%',
      '--accent-foreground': '0 0% 4%',
      '--sidebar-background': '0 0% 5%',
      '--sidebar-primary': '46 65% 52%',
      '--sidebar-accent': '0 0% 12%',
      '--sidebar-border': '0 0% 15%',
      '--sidebar-ring': '46 65% 52%',
      '--sidebar-muted': '0 0% 18%',
      '--ring': '46 65% 52%',
    },
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    nameEn: 'Rose Gold',
    preview: ['#881337', '#f43f5e', '#ffe4e6', '#ffffff'],
    light: {
      '--primary': '340 75% 30%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '348 90% 60%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '340 70% 12%',
      '--sidebar-foreground': '340 30% 95%',
      '--sidebar-primary': '348 90% 60%',
      '--sidebar-accent': '340 60% 18%',
      '--sidebar-border': '340 50% 20%',
      '--sidebar-ring': '348 90% 60%',
      '--sidebar-muted': '340 40% 22%',
      '--ring': '348 90% 60%',
    },
    dark: {
      '--primary': '348 90% 60%',
      '--primary-foreground': '340 75% 10%',
      '--accent': '348 90% 60%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '340 70% 6%',
      '--sidebar-primary': '348 90% 60%',
      '--sidebar-accent': '340 60% 14%',
      '--sidebar-border': '340 50% 12%',
      '--sidebar-ring': '348 90% 60%',
      '--sidebar-muted': '340 40% 16%',
      '--ring': '348 90% 60%',
    },
  },
  {
    id: 'cyber-blue',
    name: 'Cyber Blue',
    nameEn: 'Cyber Blue',
    preview: ['#0f172a', '#06b6d4', '#cffafe', '#ffffff'],
    light: {
      '--primary': '222 47% 11%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '189 94% 43%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '222 47% 8%',
      '--sidebar-foreground': '210 40% 95%',
      '--sidebar-primary': '189 94% 43%',
      '--sidebar-accent': '222 40% 14%',
      '--sidebar-border': '222 35% 18%',
      '--sidebar-ring': '189 94% 43%',
      '--sidebar-muted': '222 30% 20%',
      '--ring': '189 94% 43%',
    },
    dark: {
      '--primary': '189 94% 43%',
      '--primary-foreground': '222 47% 8%',
      '--accent': '189 94% 43%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '222 47% 5%',
      '--sidebar-primary': '189 94% 43%',
      '--sidebar-accent': '222 40% 12%',
      '--sidebar-border': '222 35% 12%',
      '--sidebar-ring': '189 94% 43%',
      '--sidebar-muted': '222 30% 16%',
      '--ring': '189 94% 43%',
    },
  },
  {
    id: 'vintage-copper',
    name: 'Vintage Copper',
    nameEn: 'Vintage Copper',
    preview: ['#451a03', '#d97706', '#fef3c7', '#ffffff'],
    light: {
      '--primary': '24 90% 15%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '32 95% 44%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '24 80% 8%',
      '--sidebar-foreground': '30 30% 95%',
      '--sidebar-primary': '32 95% 44%',
      '--sidebar-accent': '24 60% 12%',
      '--sidebar-border': '24 50% 15%',
      '--sidebar-ring': '32 95% 44%',
      '--sidebar-muted': '24 40% 18%',
      '--ring': '32 95% 44%',
    },
    dark: {
      '--primary': '32 95% 44%',
      '--primary-foreground': '24 90% 8%',
      '--accent': '32 95% 44%',
      '--accent-foreground': '0 0% 100%',
      '--sidebar-background': '24 80% 4%',
      '--sidebar-primary': '32 95% 44%',
      '--sidebar-accent': '24 60% 10%',
      '--sidebar-border': '24 50% 10%',
      '--sidebar-ring': '32 95% 44%',
      '--sidebar-muted': '24 40% 14%',
      '--ring': '32 95% 44%',
    },
  },
];

interface ThemeContextType {
  paletteId: string;
  setPaletteId: (id: string) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  paletteId: 'navy-gold',
  setPaletteId: () => {},
  isDark: false,
  toggleDark: () => {},
});

function applyPalette(paletteId: string, isDark: boolean) {
  const palette = THEME_PALETTES.find(p => p.id === paletteId) || THEME_PALETTES[0];
  const vars = isDark ? palette.dark : palette.light;
  const root = document.documentElement;
  
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [paletteId, setPaletteIdState] = useState(() => {
    return localStorage.getItem('theme_palette') || 'navy-gold';
  });
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme_dark') === 'true';
  });

  const setPaletteId = (id: string) => {
    setPaletteIdState(id);
    localStorage.setItem('theme_palette', id);
    applyPalette(id, isDark);
  };

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme_dark', String(next));
    applyPalette(paletteId, next);
  };

  useEffect(() => {
    applyPalette(paletteId, isDark);
  }, []);

  return (
    <ThemeContext.Provider value={{ paletteId, setPaletteId, isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export function resetToDefaultTheme() {
  localStorage.setItem('theme_palette', 'navy-gold');
  localStorage.setItem('theme_dark', 'false');
  const root = document.documentElement;
  root.classList.remove('dark');
  applyPalette('navy-gold', false);
}
