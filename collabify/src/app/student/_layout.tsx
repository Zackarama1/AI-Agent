import { RoleTabs } from '@/components/TabLayout';

export default function StudentLayout() {
  return (
    <RoleTabs
      role="student"
      tabs={[
        { name: 'index', title: 'Projects', icon: 'search' },
        { name: 'work', title: 'My work', icon: 'briefcase' },
        { name: 'profile', title: 'Profile', icon: 'person-circle' },
      ]}
    />
  );
}
