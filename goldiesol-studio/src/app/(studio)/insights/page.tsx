import { ComingInPhase } from '@/components/brand/coming-soon';
import { PageHeader } from '@/components/brand/page-header';

export const metadata = { title: 'Insights' };

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market"
        title="Insights"
        description="Rising and falling details, silhouettes and colours by region — with every number traced to its source."
      />
      <ComingInPhase phase={5} title="No trend data connected yet">
        Insights runs on a trends adapter. Until a provider is connected, any sample data will be clearly labelled as
        such — Goldiesol never shows invented market numbers.
      </ComingInPhase>
    </>
  );
}
