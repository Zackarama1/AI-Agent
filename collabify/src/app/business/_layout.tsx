import { RoleTabs } from '@/components/TabLayout';

export default function BusinessLayout() {
  return (
    <RoleTabs
      role="business"
      tabs={[
        { name: 'index', title: 'Home', icon: 'home' },
        { name: 'talent', title: 'Talent', icon: 'people' },
        { name: 'post', title: 'Post', icon: 'add-circle' },
        { name: 'inbox', title: 'Inbox', icon: 'chatbubbles', badge: 'inbox' },
        { name: 'profile', title: 'Profile', icon: 'person-circle' },
      ]}
    />
  );
}
