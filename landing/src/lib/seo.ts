import { currency, tiers } from "../data/pricing";
import { site } from "../data/site";
import { getDict, localePath, type Locale } from "../i18n";
import { features } from "../data/features";

const ORG_ID = `${site.url}/#organization`;
const SITE_ID = `${site.url}/#website`;
const APP_ID = `${site.url}/#app`;

const prices = tiers.map((t) => t.price);
export const startingPrice = `${currency}${Math.min(...prices)}`;

export const fillPrice = (text: string) => text.replaceAll("{price}", startingPrice);

// Arabic copy wraps "Nursee+" in LTR isolates so the "+" renders on the right;
// structured data and plain-text outputs get the bare name.
export const plain = (text: string) => text.replace(/[⁦-⁩]/g, "");

const abs = (path: string) => new URL(path, site.url).toString();

function organization() {
  const sameAs = [site.instagram, site.facebook, site.appStoreUrl, site.playStoreUrl].filter(Boolean);
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Nursee+",
    alternateName: ["Nursee Plus", "NurseePlus", "نيرسي بلس"],
    url: abs("/"),
    logo: { "@type": "ImageObject", url: abs("/og-logo.png"), width: 480, height: 448 },
    email: site.email,
    ...(site.phone ? { telephone: site.phone } : {}),
    address: { "@type": "PostalAddress", addressLocality: "Beirut", addressCountry: "LB" },
    areaServed: { "@type": "Country", name: "Lebanon" },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: site.email,
      ...(site.phone ? { telephone: site.phone } : {}),
      areaServed: "LB",
      availableLanguage: ["Arabic", "English", "French"],
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function website(locale: Locale) {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: abs("/"),
    name: "Nursee+",
    description: getDict(locale).meta.description,
    publisher: { "@id": ORG_ID },
    inLanguage: ["en", "ar", "fr"],
  };
}

function application(locale: Locale) {
  const t = getDict(locale);
  return {
    "@type": ["SoftwareApplication", "MobileApplication"],
    "@id": APP_ID,
    name: "Nursee+",
    url: abs(localePath(locale)),
    description: t.meta.description,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Nursery and daycare management",
    operatingSystem: "iOS, Android, Web",
    inLanguage: ["ar", "en", "fr"],
    image: abs("/og.png"),
    screenshot: abs("/og.png"),
    featureList: features.map((f) => plain(t.features.items[f.key].t)),
    countriesSupported: "LB",
    publisher: { "@id": ORG_ID },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: tiers.length,
      areaServed: { "@type": "Country", name: "Lebanon" },
    },
  };
}

function faqPage(locale: Locale) {
  const t = getDict(locale);
  return {
    "@type": "FAQPage",
    "@id": `${abs(localePath(locale))}#faq`,
    inLanguage: locale,
    mainEntity: t.faq.items.map((item) => ({
      "@type": "Question",
      name: plain(item.q),
      acceptedAnswer: { "@type": "Answer", text: plain(fillPrice(item.a)) },
    })),
  };
}

/** JSON-LD for the home page of a locale. */
export function homeSchema(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": [organization(), website(locale), application(locale), faqPage(locale)],
  };
}

/** JSON-LD for a sub-page (privacy, support, …). */
export function pageSchema(locale: Locale, path: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization(),
      website(locale),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nursee+", item: abs(localePath(locale)) },
          { "@type": "ListItem", position: 2, name: title, item: abs(localePath(locale) + path) },
        ],
      },
      { "@type": "WebPage", url: abs(localePath(locale) + path), name: title, inLanguage: locale, isPartOf: { "@id": SITE_ID }, about: { "@id": ORG_ID }, description },
    ],
  };
}
