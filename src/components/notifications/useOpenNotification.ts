import { useRouter } from "@tanstack/react-router";
import { useRole } from "@/hooks/useRole";
import { notificationLink, type ApprovalTarget, type FeedEntry } from "@/lib/notification-feed";

/** Mark an entry read and open the most specific page this person may open. */
export function useOpenNotification(
  approvalTargets: Record<string, ApprovalTarget>,
  markRead: (ids: string[]) => Promise<void>,
) {
  const router = useRouter();
  const { canOpen } = useRole();
  return (entry: FeedEntry, after?: () => void) => {
    if (entry.unreadIds.length) void markRead(entry.unreadIds);
    const lead = entry.lead;
    const link = notificationLink(lead, lead.entity_id ? approvalTargets[lead.entity_id] : null);
    after?.();
    // The route guard re-checks on arrival as well.
    if (link && canOpen(link)) void router.navigate({ href: link } as never);
  };
}
