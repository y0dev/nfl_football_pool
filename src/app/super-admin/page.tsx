import { notFound } from 'next/navigation';
import SuperAdminPageContent from './_content';

export default function SuperAdminPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <SuperAdminPageContent />;
}
