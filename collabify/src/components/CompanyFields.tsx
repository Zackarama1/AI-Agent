import { View } from 'react-native';
import type { CompanyForm } from '@/lib/profileStrength';
import { COMPANY_SIZES } from '@/lib/types';
import { space } from '@/theme';
import { Chip, Field, Label } from './ui';

export { companyCompleteness, type CompanyForm } from '@/lib/profileStrength';

export const INDUSTRIES = [
  'Food & drink', 'Fintech', 'Retail & e-commerce', 'Health & wellbeing', 'Education', 'Media & creative',
  'Software & SaaS', 'Charity & social impact', 'Fashion & beauty', 'Property', 'Travel & hospitality', 'Other',
];

export function CompanyFields({ value, onChange, only }: { value: CompanyForm; onChange: (v: CompanyForm) => void; only?: (keyof CompanyForm)[] }) {
  const show = (k: keyof CompanyForm) => !only || only.includes(k);
  const set = <K extends keyof CompanyForm>(k: K) => (v: CompanyForm[K]) => onChange({ ...value, [k]: v });
  return (
    <View>
      {show('companyName') ? <Field testID="company" label="Company" value={value.companyName} onChangeText={set('companyName')} /> : null}
      {show('industry') ? (
        <>
          <Label style={{ marginBottom: space.sm }}>Industry</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
            {INDUSTRIES.map((i) => <Chip key={i} label={i} selected={value.industry === i} onPress={() => set('industry')(value.industry === i ? '' : i)} />)}
          </View>
        </>
      ) : null}
      {show('companySize') ? (
        <>
          <Label style={{ marginBottom: space.sm }}>Team size</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
            {COMPANY_SIZES.map((s) => <Chip key={s} label={s} selected={value.companySize === s} onPress={() => set('companySize')(value.companySize === s ? '' : s)} />)}
          </View>
        </>
      ) : null}
      {show('location') ? <Field testID="company-location" label="Based in" value={value.location} onChangeText={set('location')} placeholder="e.g. Manchester" /> : null}
      {show('about') ? (
        <Field testID="company-about" label="About the company" value={value.about} onChangeText={set('about')} multiline maxLength={600} placeholder="What you do, who for, and what it's like to work with you." hint={`${value.about.length}/600`} />
      ) : null}
      {show('website') ? <Field label="Website (optional)" value={value.website} onChangeText={set('website')} autoCapitalize="none" keyboardType="url" placeholder="https://" /> : null}
    </View>
  );
}
