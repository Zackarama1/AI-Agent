import { Ionicons } from '@expo/vector-icons';
import { getApi } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useQuery } from '@/lib/useQuery';
import { useTheme } from '@/theme';
import { useFeedback } from './feedback';
import { PressableScale } from './motion';

/** Bookmark toggle for students. */
export function SaveButton({ projectId, size = 22 }: { projectId: string; size?: number }) {
  const { colors } = useTheme();
  const { toast } = useFeedback();
  const { data: saved } = useQuery((api) => api.listSavedIds());
  const isSaved = Boolean(saved?.includes(projectId));
  return (
    <PressableScale
      testID={`save-${projectId}`}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove from saved' : 'Save for later'}
      accessibilityState={{ selected: isSaved }}
      hitSlop={10}
      scaleTo={0.8}
      onPress={async () => {
        haptic.tap();
        await getApi().setSaved(projectId, !isSaved);
        toast(isSaved ? 'Removed from saved' : 'Saved for later', isSaved ? 'bookmark-outline' : 'bookmark');
      }}
    >
      <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={size} color={isSaved ? colors.primary : colors.textMuted} />
    </PressableScale>
  );
}
