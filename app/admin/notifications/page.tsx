import NotificationsFeed from '@/components/admin/NotificationsFeed';

export const metadata = { title: 'Notifications · Admin · YOYO GEMS' };

export default function NotificationsPage() {
  return <>
    <h1>Notifications</h1>
    <p>New orders and requirements, changes customers make to their orders, sign-up requests and website catalogue requests. Tap one to open it.</p>
    <NotificationsFeed />
  </>;
}
