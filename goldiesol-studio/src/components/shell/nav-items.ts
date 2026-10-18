import {
  Factory, Gem, Home, Layers, LineChart, Palette, Scissors, Settings, Shapes,
} from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/', label: 'Studio', icon: Home },
  { href: '/designs', label: 'Designs', icon: Scissors },
  { href: '/collections', label: 'Collections', icon: Layers },
  { href: '/shapes', label: 'Shapes', icon: Shapes },
  { href: '/materials', label: 'Materials', icon: Gem },
  { href: '/colours', label: 'Colours', icon: Palette },
  { href: '/insights', label: 'Insights', icon: LineChart },
  { href: '/suppliers', label: 'Suppliers', icon: Factory },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;


export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
