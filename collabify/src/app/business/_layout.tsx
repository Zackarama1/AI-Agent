import { RoleTabs } from '@/components/TabLayout';

export default function BusinessLayout() {
  return (
    <RoleTabs
      role="business"
      tabs={[
        { name: 'index', title: 'Projects', icon: 'albums' },
        { name: 'post', title: 'Post', icon: 'add-circle' },
        { name: 'profile', title: 'Profile', icon: 'person-circle' },
      ]}
    />
  );
}
