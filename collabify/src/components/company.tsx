import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { initials } from '@/lib/format';
import type { Business, BusinessStats } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';
import { Body, Muted, Row } from './ui';

const TILE_COLORS = ['#5B3DF5', '#0A84FF', '#30B0C7', '#248A3D', '#FF9F0A', '#FF375F', '#AF52DE', '#5856D6'];

/** Stable colour per company name, so a company always looks the same everywhere. */
export function tileColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

/** Rounded-square company mark (companies are squares, people are circles). */
export function CompanyLogo({ name, size = 44 }: { name: string; size?: number }) {
  const clean = name.replace(/\s*\(demo\)$/i, '');
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: tileColor(clean), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: fonts.heavy, fontSize: size * 0.4, letterSpacing: -0.5 }}>{initials(clean)}</Text>
    </View>
  );
}

/** "Fintech · 11–50 people · London": only the parts the company has filled in. */
export function companyFacts(b: Pick<Business, 'industry' | 'companySize' | 'location'>) {
  return [b.industry, b.companySize ? (b.companySize === 'Just me' ? 'Solo founder' : `${b.companySize} people`) : '', b.location].filter(Boolean).join(' · ');
}

export function memberSince(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null;
}

/** Track record from real contracts. Shows "New to Collabify" instead of zeros. */
export function TrackRecord({ stats, rating }: { stats: BusinessStats; rating: { average: number | null; count: number } }) {
  const { colors } = useTheme();
  if (stats.studentsHired === 0 && stats.paidProjects === 0) {
    return (
      <Row>
        <Ionicons name="sparkles" size={16} color={colors.primary} />
        <Muted style={{ fontSize: 14 }}>New to Collabify{memberSince(stats.memberSince) ? ` · joined ${memberSince(stats.memberSince)}` : ''}</Muted>
      </Row>
    );
  }
  const tiles = [
    { value: String(stats.studentsHired), label: stats.studentsHired === 1 ? 'student hired' : 'students hired' },
    { value: String(stats.paidProjects), label: stats.paidProjects === 1 ? 'project paid' : 'projects paid' },
    { value: rating.average ? `${rating.average.toFixed(1)}★` : 'New', label: rating.count ? `${rating.count} review${rating.count === 1 ? '' : 's'}` : 'no reviews yet' },
  ];
  return (
    <View>
      <Row gap={space.sm}>
        {tiles.map((t) => (
          <View key={t.label} style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center' }}>
            <Body style={{ fontFamily: fonts.heavy, fontSize: 22, letterSpacing: -0.6 }}>{t.value}</Body>
            <Muted style={{ fontSize: 12, textAlign: 'center' }}>{t.label}</Muted>
          </View>
        ))}
      </Row>
      {memberSince(stats.memberSince) ? <Muted style={{ fontSize: 12, marginTop: space.sm }}>On Collabify since {memberSince(stats.memberSince)}</Muted> : null}
    </View>
  );
}
