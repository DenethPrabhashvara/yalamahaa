import Script from "next/script";
import Footer from "./Footer";
import FrequentlyAskedQuestionsSection from "./FrequentlyAskedQuestionsSection";
import Header from "./Header";
import MetricsSection from "./MetricsSection";
import SiteRelative10 from "./SiteRelative10";
import SiteRelative11 from "./SiteRelative11";
import SiteRelative12 from "./SiteRelative12";
import SiteRelative13 from "./SiteRelative13";
import SiteRelative2 from "./SiteRelative2";
import SiteRelative3 from "./SiteRelative3";
import SiteRelative5 from "./SiteRelative5";
import SiteRelative8 from "./SiteRelative8";
import Motion from "./Motion";
import SmartAssistSection from "./SmartAssistSection";
import { getDict, type Lang } from "../../lib/i18n";
import { getSiteUrl } from "../../lib/seo";
import { SITE } from "../../lib/site";

const motion =
  '[{"id":"r1","type":"resp","mq":"(max-width: 767.98px)","add":["site-from-black-80","site-to-black-40"],"remove":["site-from-black-90","to-transparent"]},{"id":"r2","type":"resp","mq":"(max-width: 767.98px)","add":["site-from-black-90","to-transparent"],"remove":["site-from-black-80","site-to-black-40"]}]';

export default function LandingPage({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: SITE.name,
        inLanguage: lang,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}#application`,
        name: SITE.name,
        url: siteUrl,
        image: new URL("/images/logo-icon.png", siteUrl).toString(),
        description: t.meta.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Android, iOS",
        inLanguage: ["en", "si", "ta"],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <link rel="stylesheet" href="/assets/css/landing.css" precedence="default" />
      <>
        <Header t={t} lang={lang} />
        {"  "}
        <SiteRelative2 t={t} />
        {"  "}
        <SiteRelative3 t={t} />
        {"  "}
        <SiteRelative5 t={t} />
        {"  "}
        <SiteRelative8 t={t} />
        {"  "}
        <MetricsSection t={t} />
        {"  "}
        <SiteRelative10 t={t} />
        {"  "}
        <SmartAssistSection t={t} />
        {"  "}
        <SiteRelative11 t={t} />
        {"  "}
        <SiteRelative12 t={t} />
        {"  "}
        <FrequentlyAskedQuestionsSection t={t} />
        {"  "}
        <SiteRelative13 t={t} />
        <Footer t={t} />
        <Motion />
      </>
      <div id="dittu-motion" data-motion={motion} hidden />
      <Script src="/assets/dittu-motion.js" strategy="afterInteractive" />
    </>
  );
}
