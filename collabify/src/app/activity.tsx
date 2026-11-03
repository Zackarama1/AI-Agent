import { ActivityFeed } from '@/components/ActivityFeed';
import { Empty, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/lib/useQuery';

export default function Activity() {
  const { data } = useQuery((api) => api.listNotifications());
  return (
    <Screen title="Activity" edges={[]}>
      {!data ? <Loading /> : data.length === 0 ? (
        <Empty icon="notifications-outline" title="Nothing yet" text="Applications, payments and messages will show up here." />
      ) : (
        <ActivityFeed items={data} />
      )}
    </Screen>
  );
}
