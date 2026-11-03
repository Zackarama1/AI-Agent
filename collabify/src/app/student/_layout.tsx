import { RoleTabs } from '@/components/TabLayout';

export default function StudentLayout() {
  return (
    <RoleTabs
      role="student"
      tabs={[
        { name: 'index', title: 'Discover', icon: 'compass' },
        { name: 'saved', title: 'Saved', icon: 'bookmark' },
        { name: 'work', title: 'My work', icon: 'briefcase' },
        { name: 'inbox', title: 'Inbox', icon: 'chatbubbles', badge: 'inbox' },
        { name: 'profile', title: 'Profile', icon: 'person-circle' },
      ]}
    />
  );
}
