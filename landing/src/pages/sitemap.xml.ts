import type { APIRoute } from "astro";
import { site } from "../data/site";
import { localePath, locales } from "../i18n";

const pages = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "support/", priority: "0.6", changefreq: "monthly" },
  { path: "privacy/", priority: "0.4", changefreq: "yearly" },
  { path: "delete-account/", priority: "0.3", changefreq: "yearly" },
];

const url = (locale: (typeof locales)[number], path: string) => new URL(localePath(locale) + path, site.url).toString();

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const entries = pages.flatMap((p) =>
    locales.map((locale) => {
      const alternates = locales
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(l, p.path)}"/>`)
        .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${url("en", p.path)}"/>`)
        .join("\n");
      return `  <url>
    <loc>${url(locale, p.path)}</loc>
${alternates}
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
