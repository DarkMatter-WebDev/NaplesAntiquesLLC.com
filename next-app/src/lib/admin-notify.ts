import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminNotificationInput = {
  /** e.g. 'message' (contact form), 'inquiry' (lead forms), 'order' (checkout). */
  type: string;
  title: string;
  body: string;
  customerName?: string | null;
  customerEmail?: string | null;
  /** Customer-attached photo URLs (Storage public URLs). */
  imageUrls?: string[];
};

/**
 * Insert a row into the admin message center (admin_notifications).
 *
 * Best-effort: returns true on success, false on failure — the caller decides
 * whether a failure matters (lead/message submissions still save their primary
 * record and email, so a failed notification should not fail the request).
 *
 * Requires a SERVICE-ROLE client: admin_notifications RLS allows only admins to
 * write, and the table needs the service_role INSERT grant
 * (supabase/service-role-insert-grants.sql). Falls back to inserting without the
 * image_urls column (keeping photo links in the body) when that column isn't
 * present yet (admin-notifications-image-urls.sql not applied).
 */
export async function createAdminNotification(
  service: SupabaseClient,
  input: AdminNotificationInput,
): Promise<boolean> {
  const imageUrls = input.imageUrls ?? [];
  const row = {
    type: input.type,
    title: input.title,
    body: input.body,
    customer_name: input.customerName ?? null,
    customer_email: input.customerEmail ?? null,
  };

  const { error } = await service.from('admin_notifications').insert({ ...row, image_urls: imageUrls });
  if (!error) return true;

  if (/image_urls|column|schema cache/i.test(error.message)) {
    // image_urls column not present yet — keep photo links in the body so they
    // are never lost, and insert without the column.
    const fallbackBody = imageUrls.length ? `${input.body}\n\nPhotos:\n${imageUrls.join('\n')}` : input.body;
    const retry = await service.from('admin_notifications').insert({ ...row, body: fallbackBody });
    if (!retry.error) return true;
    console.error('admin_notifications insert error:', retry.error);
    return false;
  }

  console.error('admin_notifications insert error:', error);
  return false;
}
