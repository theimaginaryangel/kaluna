import { EventDetailClient } from "@/components/events/event-detail-client";

export async function generateStaticParams() {
  return [
    { id: "evt-101" },
    { id: "evt-102" },
    { id: "evt-103" },
    { id: "evt-104" },
    { id: "evt-105" },
    { id: "evt-106" },
    { id: "next-gen-ai-agents" },
    { id: "kaluna-salon-speculative-fiction" },
    { id: "hands-on-rust-systems" },
    { id: "quantum-computing-hardware" },
    { id: "deep-reading-micro-essay-workshop" },
    { id: "ui-ux-design-systems-motion" },
  ];
}

export default function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <EventDetailClient id={params.id} />;
}
