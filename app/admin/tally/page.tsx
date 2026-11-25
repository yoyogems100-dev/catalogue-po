import { tallyGate } from '@/lib/tally/auth';
import TallyApp from './TallyApp';
import './tally.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tally accounts · Admin · YOYO GEMS', robots: { index: false, follow: false } };

// The admin layout already requires the admin login; the Tally password is
// checked on top of it (lib/tally/auth.ts) by every Tally route.
export default async function TallyPage() {
  const gate = await tallyGate();
  return <TallyApp initialGate={gate === 'admin' ? 'locked' : gate} />;
}
