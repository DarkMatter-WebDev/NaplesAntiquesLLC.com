export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function withMarketingFooter(html: string, unsubscribeUrl: string, mailingAddress: string) {
  return `${html}
<hr style="border:0;border-top:1px solid #e7dfcf;margin:32px 0 16px;" />
<p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#6f675c;">
  Naples Estate Jewelry Co<br />
  ${escapeHtml(mailingAddress).replace(/\n/g, '<br />')}<br />
  You are receiving this marketing email because you subscribed or have a Naples Estate Jewelry account.
  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#735c00;">Unsubscribe</a>
</p>`;
}
