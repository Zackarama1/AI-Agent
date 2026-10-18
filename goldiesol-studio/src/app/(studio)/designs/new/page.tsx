import { PageHeader } from '@/components/brand/page-header';
import { NewDesignForm } from '@/components/designs/new-design-form';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'New design' };
export const dynamic = 'force-dynamic'; // shape library changes as shapes are saved

export default async function NewDesign() {
  const repo = await getRepository();
  const [tops, bottoms] = await Promise.all([repo.listShapes('top'), repo.listShapes('bottom')]);

  return (
    <>
      <PageHeader
        eyebrow="New design"
        title="Which top and bottom are we building today?"
        description="Your favourites come first. The Design Partner's brief interview joins this step in build phase 4."
      />
      <NewDesignForm tops={tops} bottoms={bottoms} />
    </>
  );
}
