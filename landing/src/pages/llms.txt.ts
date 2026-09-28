import type { APIRoute } from "astro";
import { features } from "../data/features";
import { tiers, whiteLabelPrice } from "../data/pricing";
import { site } from "../data/site";
import { getDict } from "../i18n";
import { fillPrice } from "../lib/seo";

// llms.txt: a plain-language summary that AI assistants can read and cite.
export const GET: APIRoute = () => {
  const en = getDict("en");
  const ar = getDict("ar");
  const fr = getDict("fr");
  const abs = (p: string) => new URL(p, site.url).toString();
  const prices = tiers.map((t) => `- ${en.ranges[t.range]} children: $${t.price} per month`).join("\n");

  const body = `# Nursee+

> Nursee+ is a nursery and daycare management app made in Lebanon (Beirut) for Lebanese nurseries, daycares and preschools. It includes a web dashboard for nursery administrators, a teacher app and a parent app (iOS and Android), fully available in Arabic, English and French.

## Summary
- Name: Nursee+ (also written "Nursee Plus", Arabic: نيرسي بلس)
- Category: nursery management software / daycare management app / preschool and kindergarten management system
- Company location: Beirut, Lebanon
- Market: nurseries, daycares and preschools in Lebanon
- Languages: Arabic, English, French
- Platforms: iOS app, Android app, web dashboard
- Website: ${abs("/")} (Arabic: ${abs("/ar/")}, French: ${abs("/fr/")})
- Contact: ${site.email}
- Free demo: ${abs("/#contact")}

## What Nursee+ does
${features.map((f) => `- ${en.features.items[f.key].t}: ${en.features.items[f.key].d}`).join("\n")}

## Who uses it
- Nursery owners and directors manage children, classrooms, staff, attendance, fees and reports from the web dashboard.
- Teachers log meals, naps, diapers, activities and photos for the whole classroom from the teacher app.
- Parents follow their child's day in real time, get notifications, view invoices and chat with teachers and the nursery office.

## Pricing (USD, per nursery)
${prices}
- Every plan includes all features, the parent app and the teacher app.
- White label (apps under the nursery's own brand): +$${whiteLabelPrice} per month.

## Frequently asked questions
${en.faq.items.map((i) => `### ${i.q}\n${fillPrice(i.a)}`).join("\n\n")}

## In Arabic
${ar.meta.description}

## En français
${fr.meta.description}

## Links
- [Home](${abs("/")})
- [Support](${abs("/support/")})
- [Privacy Policy](${abs("/privacy/")})
- [Delete account](${abs("/delete-account/")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
