"use client";
/**
 * <TrackedOutboundLink> — wraps an external link to fire /api/track/outbound
 * before the browser navigates away. Falls back to normal <a> on no-JS.
 *
 * Usage:
 *   <TrackedOutboundLink href={url} resourceId={r.id} sourceId={r.sourceId} lang="zh">
 *     View Original →
 *   </TrackedOutboundLink>
 */
import { AnchorHTMLAttributes, MouseEvent } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  resourceId?: string;
  sourceId?: string;
  lang?: string;
};

export default function TrackedOutboundLink(props: Props) {
  const { href, resourceId, sourceId, lang, onClick, children, ...rest } = props;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Allow modifier-keys (open in new tab) to bypass tracking
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Track — fire and forget
    try {
      const payload = JSON.stringify({ targetUrl: href, resourceId, sourceId, lang });
      const blob = new Blob([payload], { type: "application/json" });
      // sendBeacon is the right tool here: fire-and-forget, no CORS preflight, no body limit
      navigator.sendBeacon?.("/api/track/outbound", blob) ||
        fetch("/api/track/outbound", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {
      // swallow
    }
    onClick?.(e);
  };

  return (
    <a href={href} rel="noopener noreferrer ugc" target="_blank" onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
