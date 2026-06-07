const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gametoolx.top";

export async function GET() {
  const body = `# GameToolX robots.txt
User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
