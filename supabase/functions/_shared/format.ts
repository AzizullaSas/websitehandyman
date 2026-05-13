// Shared helpers for Telegram lead notifications.

export const STATUS_LABELS: Record<string, string> = {
  new: "🟡 New",
  contacted: "📞 Contacted",
  quoted: "💰 Quoted",
  won: "🏆 Won",
  lost: "❌ Lost",
};

// Telegram Markdown V1 escaping — keep it conservative.
export function md(s: unknown): string {
  return String(s ?? "").replace(/([_*`\[\]])/g, "\\$1");
}

export function formatLead(lead: Record<string, unknown>, status: string): string {
  const created = lead.created_at
    ? new Date(String(lead.created_at)).toLocaleString("en-US", {
        timeZone: "Pacific/Honolulu",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const lines: string[] = [
    `🛎 *New Lead* — ${STATUS_LABELS[status] ?? status}`,
    ``,
    `👤 *${md(lead.name)}*`,
    `📞 [${md(lead.phone)}](tel:${encodeURIComponent(String(lead.phone))})`,
  ];
  if (lead.email)      lines.push(`📧 ${md(lead.email)}`);
  if (lead.tv_size)    lines.push(`📺 TV: ${md(lead.tv_size)}`);
  if (lead.wall_type)  lines.push(`🧱 Wall: ${md(lead.wall_type)}`);
  if (lead.message)    lines.push(``, `💬 _${md(lead.message)}_`);
  if (created)         lines.push(``, `⏱ ${md(created)} HST`);
  return lines.join("\n");
}

export function buildKeyboard(leadId: string, currentStatus: string) {
  const opts = [
    { label: "📞 Contacted", value: "contacted" },
    { label: "💰 Quoted",    value: "quoted"    },
    { label: "🏆 Won",       value: "won"       },
    { label: "❌ Lost",      value: "lost"      },
  ];
  const decorate = (o: { label: string; value: string }) => ({
    text: o.value === currentStatus ? `✓ ${o.label}` : o.label,
    callback_data: `s:${o.value}:${leadId}`,
  });
  return {
    inline_keyboard: [opts.slice(0, 2).map(decorate), opts.slice(2).map(decorate)],
  };
}
