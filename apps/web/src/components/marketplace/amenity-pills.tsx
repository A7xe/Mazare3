import { Waves, Flame, Users, Moon, Wifi, Car, UtensilsCrossed } from 'lucide-react';

const AMENITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pool: Waves,
  heated: Flame,
  football: Users,
  overnight: Moon,
  wifi: Wifi,
  parking: Car,
  bbq: UtensilsCrossed,
};

interface AmenityPillsProps {
  keys: string[];
  max?: number;
}

export function AmenityPills({ keys, max = 4 }: AmenityPillsProps) {
  const shown = keys.slice(0, max);

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((key) => {
        const Icon = AMENITY_ICONS[key] ?? Waves;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs text-muted"
          >
            <Icon className="h-3 w-3" aria-hidden />
            {key}
          </span>
        );
      })}
    </div>
  );
}
