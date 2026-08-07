import { EditEventClient } from '@/components/admin/edit-event-client';

export async function generateStaticParams() {
  return [
    { id: 'evt-101' },
    { id: 'evt-102' },
    { id: 'evt-103' },
    { id: 'evt-104' },
    { id: 'evt-105' },
    { id: 'evt-106' },
  ];
}

export default function EditEventPage({ params }: { params: { id: string } }) {
  return <EditEventClient id={params.id} />;
}
