import { describe, expect, it } from '@jest/globals';
import { freshApi, signIn } from '../demo/testing';

const MAYA = 'maya@student.demo.ac.uk';
const SARA = 'sara@brewbox.demo';

describe('demo store: the full project lifecycle', () => {
  it('hire → pay → deliver → approve → blind reviews', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    const contract = await api.hire('a3'); // Maya on the £900 account page project, Free plan
    expect(contract).toMatchObject({ amountPence: 90000, feePence: 10800, totalPence: 100800, status: 'awaiting_funding' });
    await expect(api.deliver(contract.id, 'too early', [])).rejects.toThrow();

    await api.fundContract(contract.id);
    await signIn(api, MAYA);
    await api.deliver(contract.id, 'All done, preview link inside.', []);
    const delivered = await api.getContract(contract.id);
    expect(delivered?.status).toBe('delivered');
    expect(new Date(delivered!.autoReleaseAt!).getTime()).toBeGreaterThan(Date.now() + 6.9 * 86400000);

    await signIn(api, SARA, 'business');
    await api.approve(contract.id);
    expect((await api.getContract(contract.id))?.status).toBe('released');

    await api.submitReview(contract.id, 5, 'Great');
    await signIn(api, MAYA);
    expect((await api.getContractReviews(contract.id)).theirs).toBeNull();
    await api.submitReview(contract.id, 4, 'Nice client');
    expect((await api.getContractReviews(contract.id)).theirs?.rating).toBe(5);
  });

  it('rejects budgets below £12.71/hour and non-.ac.uk students', async () => {
    const api = freshApi();
    await expect(api.requestCode('someone@gmail.com', 'student')).rejects.toThrow('.ac.uk');
    await signIn(api, SARA, 'business');
    await expect(
      api.createProject({ title: 'Cheap logo', category: 'Design', brief: 'A logo with a couple of concepts for our new brand.', budgetPence: 10000, estimatedHours: 10, durationDays: 7, skills: [], deliverables: ['Logo'], level: 'beginner', workMode: 'remote', city: '' }),
    ).rejects.toThrow('£12.71');
  });

  it('stops students acting as businesses', async () => {
    const api = freshApi();
    await signIn(api, MAYA);
    await expect(api.hire('a3')).rejects.toThrow();
    await expect(api.listApplicants('p_portal')).rejects.toThrow();
  });
});

describe('demo store: revisions, cancellations, disputes, featuring', () => {
  const TOM = 'tom@student.demo.ac.uk';
  const ADMIN = 'admin@collabify.demo';

  it('asking for changes keeps payment held and pauses auto-release', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    const c = await api.hire('a3');
    await api.fundContract(c.id);
    await signIn(api, MAYA);
    await api.deliver(c.id, 'First version is ready.', []);
    await signIn(api, SARA, 'business');
    await expect(api.requestChanges(c.id, 'short')).rejects.toThrow();
    await api.requestChanges(c.id, 'Please make the buttons bigger.');
    const after = await api.getContract(c.id);
    expect(after).toMatchObject({ status: 'funded', autoReleaseAt: null, revisionCount: 1 });
    expect((await api.listMessages(c.id)).at(-1)?.body).toMatch(/^Changes requested/);
    await signIn(api, MAYA);
    await api.deliver(c.id, 'Buttons are bigger now.', []);
    expect((await api.getContract(c.id))?.status).toBe('delivered');
  });

  it('cancelling an unpaid hire reopens the project and restores other applicants', async () => {
    const api = freshApi();
    await signIn(api, 'dan@tidyly.demo', 'business');
    const c = await api.hire('a2'); // Maya on the logo project; Ravi (a1) gets auto-declined
    expect((await api.listApplicants('p_logo')).find((a) => a.id === 'a1')?.status).toBe('declined');
    await api.cancelContract(c.id);
    expect((await api.getProject('p_logo'))?.status).toBe('open');
    const apps = await api.listApplicants('p_logo');
    expect(apps.find((a) => a.id === 'a1')?.status).toBe('applied');
    expect(apps.find((a) => a.id === 'a2')?.status).toBe('shortlisted');
    expect(await api.getContractForProject('p_logo')).toBeNull();
    await api.hire('a1'); // can hire someone else
  });

  it('paid hires cannot be cancelled', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    await expect(api.cancelContract('c_social')).rejects.toThrow('Report a problem');
  });

  it('students withdraw applications; businesses cancel open projects', async () => {
    const api = freshApi();
    await signIn(api, MAYA);
    await api.withdrawApplication('a3');
    expect(await api.getMyApplication('p_portal')).toBeNull();
    await signIn(api, SARA, 'business');
    await api.cancelProject('p_survey');
    expect((await api.listOpenProjects()).some((p) => p.id === 'p_survey')).toBe(false);
  });

  it('featuring pins a project to the top for 7 days', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    await api.featureProject('p_survey');
    const top = (await api.listOpenProjects())[0];
    expect(top.featured).toBe(true);
    const featuredIds = (await api.listOpenProjects()).filter((p) => p.featured).map((p) => p.id);
    expect(featuredIds).toContain('p_survey');
    const until = new Date((await api.getProject('p_survey'))!.featuredUntil!).getTime();
    expect(until - Date.now()).toBeGreaterThan(6.9 * 86400000);
  });

  it('admin resolves a reported problem either way', async () => {
    const api = freshApi();
    await signIn(api, TOM);
    await api.raiseIssue('c_social', 'The client stopped replying to messages.');
    await signIn(api, ADMIN, 'business');
    const { disputes } = await api.adminOverview();
    expect(disputes.map((d) => d.id)).toEqual(['c_social']);
    expect(disputes[0].issueReason).toMatch(/stopped replying/);
    await api.adminResolve('c_social', 'refund');
    expect((await api.getContract('c_social'))?.status).toBe('refunded');
    await expect(api.adminResolve('c_social', 'release')).rejects.toThrow();

    await signIn(api, 'dan@tidyly.demo', 'business');
    await api.raiseIssue('c_churn', 'The dashboard is missing half the data.');
    await signIn(api, ADMIN, 'business');
    await api.adminResolve('c_churn', 'release');
    expect((await api.getContract('c_churn'))?.status).toBe('released');
  });

  it('only admins can resolve', async () => {
    const api = freshApi();
    await signIn(api, TOM);
    await api.raiseIssue('c_social', 'The client stopped replying to messages.');
    await expect(api.adminResolve('c_social', 'release')).rejects.toThrow();
  });
});

describe('demo store: account deletion', () => {
  it('is refused while payment is held', async () => {
    const api = freshApi();
    await signIn(api, 'tom@student.demo.ac.uk'); // c_social is funded
    await expect(api.deleteAccount()).rejects.toThrow('payment held');
    expect(await api.getSession()).not.toBeNull();
  });

  it('anonymises the person, keeps finished work, and signs them out', async () => {
    const api = freshApi();
    await signIn(api, 'ravi@student.demo.ac.uk');
    await api.deleteAccount();
    expect(await api.getSession()).toBeNull();
    const ravi = await api.getStudent('s_ravi');
    expect(ravi).toMatchObject({ fullName: 'Deleted user', university: '', skills: [] });
    await signIn(api, 'dan@tidyly.demo', 'business');
    expect((await api.listApplicants('p_logo')).some((a) => a.studentId === 's_ravi')).toBe(false);
  });

  it('businesses with payment held cannot delete', async () => {
    const api = freshApi();
    await signIn(api, 'dan@tidyly.demo', 'business');
    await expect(api.deleteAccount()).rejects.toThrow(); // c_churn is delivered, payment held
  });

  it('a deleted business has its open projects closed', async () => {
    const api = freshApi();
    await signIn(api, 'new@startup.demo', 'business');
    await api.completeOnboarding({ role: 'business', fullName: 'New Founder', companyName: 'New Co', website: '', industry: 'Retail', companySize: 'Just me', location: 'Leeds', about: '' });
    const p = await api.createProject({ title: 'Logo for New Co', category: 'Design', brief: 'A simple logo with two concepts for our brand.', budgetPence: 20000, estimatedHours: 10, durationDays: 7, skills: ['Figma'], deliverables: ['Logo files'], level: 'beginner', workMode: 'remote', city: '' });
    await api.deleteAccount();
    expect((await api.getProject(p.id))?.status).toBe('cancelled');
    expect((await api.listOpenProjects()).some((x) => x.id === p.id)).toBe(false);
  });
});

describe('demo store: notifications', () => {
  const kinds = async (api: ReturnType<typeof freshApi>) => (await api.listNotifications()).map((n) => n.kind);

  it('tells each side what happened, and only them', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    const c = await api.hire('a3');
    await api.fundContract(c.id);
    await signIn(api, MAYA);
    expect(await kinds(api)).toEqual(expect.arrayContaining(['hired', 'funded']));
    await api.deliver(c.id, 'Done, preview link inside.', []);
    await api.sendMessage(c.id, 'Let me know what you think!');
    await signIn(api, SARA, 'business');
    const sara = await api.listNotifications();
    expect(sara.map((n) => n.kind)).toEqual(expect.arrayContaining(['delivered', 'message']));
    expect(sara.find((n) => n.kind === 'message')).toMatchObject({ title: 'Maya Patel', link: `/chat/${c.id}` });
    expect(sara.some((n) => n.kind === 'hired')).toBe(false);
    await api.approve(c.id);
    await signIn(api, MAYA);
    expect((await api.listNotifications())[0]).toMatchObject({ kind: 'paid', title: 'You’ve been paid £900' });
  });

  it('other applicants hear the project was filled', async () => {
    const api = freshApi();
    await signIn(api, 'dan@tidyly.demo', 'business');
    await api.hire('a2'); // Maya hired; Ravi (a1) auto-declined
    await signIn(api, 'ravi@student.demo.ac.uk');
    expect(await kinds(api)).toContain('filled');
  });

  it('marks everything read', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    expect((await api.listNotifications()).some((n) => !n.readAt)).toBe(true);
    await api.markNotificationsRead();
    expect((await api.listNotifications()).every((n) => n.readAt)).toBe(true);
  });
});

describe('demo store: invites', () => {
  it('suggests matching students who have not applied, and remembers invites', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    const survey = await api.suggestStudents('p_survey'); // data project: Lena matches, already invited in the seed
    expect(survey[0]).toMatchObject({ student: { id: 's_lena' }, invited: true });
    await expect(api.inviteStudent('p_survey', 's_lena')).rejects.toThrow('Already invited');
    expect(await api.suggestStudents('p_portal')).toEqual([]); // only Maya knows React, and she applied
    await signIn(api, 'dan@tidyly.demo', 'business');
    const logo = await api.suggestStudents('p_logo');
    expect(logo.some((s) => ['s_maya', 's_ravi'].includes(s.student.id))).toBe(false); // both applied
  });

  it('the student is notified and sees the invite', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    await api.inviteStudent('p_survey', 's_tom');
    await signIn(api, 'tom@student.demo.ac.uk');
    expect(await api.listMyInvites()).toContain('p_survey');
    expect((await api.listNotifications())[0]).toMatchObject({ kind: 'invited', link: '/project/p_survey' });
  });

  it('only the owner can invite, only to open projects', async () => {
    const api = freshApi();
    await signIn(api, 'dan@tidyly.demo', 'business');
    await expect(api.inviteStudent('p_portal', 's_tom')).rejects.toThrow('Not your project');
    await signIn(api, SARA, 'business');
    await expect(api.inviteStudent('p_social', 's_maya')).rejects.toThrow('open'); // in progress
  });
});

describe('demo store: listings', () => {
  it('companies show an accurate, computed track record', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    const before = (await api.getBusiness('b_sara'))!;
    expect(before).toMatchObject({ industry: 'Food & drink', companySize: '2–10', location: 'Bristol' });
    expect(before.stats).toMatchObject({ studentsHired: 2, paidProjects: 1, openProjects: 2 });
    const c = await api.hire('a3');
    await api.fundContract(c.id);
    expect((await api.getBusiness('b_sara'))!.stats).toMatchObject({ studentsHired: 2, openProjects: 1 }); // Maya was already hired once
  });

  it('projects carry deliverables, level and where the work happens', async () => {
    const api = freshApi();
    const logo = (await api.getProject('p_logo'))!;
    expect(logo.deliverables).toEqual(['2\u20133 concepts', 'Final logo (SVG, PNG)', 'One-page brand guide']);
    expect(logo.brief).not.toMatch(/Deliverables/);
    expect((await api.getProject('p_social'))!).toMatchObject({ workMode: 'hybrid', city: 'Bristol' });
    await signIn(api, SARA, 'business');
    const base = { title: 'Stall branding', category: 'Design', brief: 'Branding for a weekend market stall in Bristol.', budgetPence: 30000, estimatedHours: 20, durationDays: 10, skills: [], level: 'beginner' as const };
    await expect(api.createProject({ ...base, deliverables: [], workMode: 'remote', city: '' })).rejects.toThrow('deliverable');
    await expect(api.createProject({ ...base, deliverables: ['Logo'], workMode: 'in_person', city: '' })).rejects.toThrow('city');
    const p = await api.createProject({ ...base, deliverables: ['Logo', ' '], workMode: 'in_person', city: 'Bristol' });
    expect(p).toMatchObject({ deliverables: ['Logo'], workMode: 'in_person', city: 'Bristol' });
  });

  it('lists a company\u2019s open projects', async () => {
    const api = freshApi();
    const dan = await api.listOpenProjects({ businessId: 'b_dan' });
    expect(dan.map((p) => p.id).sort()).toEqual(['p_logo', 'p_research']);
  });
});

describe('demo store: inbox, saved, talent', () => {
  it('lists one conversation per project with the latest message and unread count', async () => {
    const api = freshApi();
    await signIn(api, 'tom@student.demo.ac.uk');
    await api.sendMessage('c_social', 'Draft calendar is in the shared folder.');
    await signIn(api, SARA, 'business');
    const convs = await api.listConversations();
    expect(convs[0]).toMatchObject({ contractId: 'c_social', otherName: 'Tom Okafor', otherIsCompany: false, unread: 1 });
    expect(convs[0].lastMessage).toMatchObject({ body: 'Draft calendar is in the shared folder.', mine: false });
    await api.markConversationRead('c_social');
    expect((await api.listConversations())[0].unread).toBe(0);
    await signIn(api, 'tom@student.demo.ac.uk');
    expect((await api.listConversations())[0]).toMatchObject({ otherName: 'Brewbox (demo)', otherIsCompany: true, lastMessage: { mine: true } });
  });

  it('saves and unsaves projects for the student only', async () => {
    const api = freshApi();
    await signIn(api, MAYA);
    expect(await api.listSavedIds()).toEqual(['p_research']);
    await api.setSaved('p_survey', true);
    await api.setSaved('p_survey', true); // idempotent
    expect((await api.listSavedProjects()).map((p) => p.id)).toEqual(['p_survey', 'p_research']);
    await api.setSaved('p_research', false);
    expect(await api.listSavedIds()).toEqual(['p_survey']);
    await signIn(api, SARA, 'business');
    await expect(api.listSavedIds()).rejects.toThrow();
  });

  it('lets businesses browse verified students by skill and search', async () => {
    const api = freshApi();
    await signIn(api, SARA, 'business');
    const all = await api.listStudents();
    expect(all[0].fullName).toBe('Maya Patel'); // best rated first
    expect((await api.listStudents({ skill: 'figma' })).map((s) => s.id).sort()).toEqual(['s_maya', 's_ravi']);
    expect((await api.listStudents({ search: 'edinburgh' })).map((s) => s.id)).toEqual(['s_lena']);
    await signIn(api, MAYA);
    await expect(api.listStudents()).rejects.toThrow();
  });
});
