import type { Metadata } from "next";
import LandingPage from "../../components/landing/LandingPage";
import { getDict } from "../../lib/i18n";

const t = getDict("en");

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Yala Maha",
    title: t.meta.title,
    description: t.meta.description,
    images: [{ url: "/images/logo-icon.png", alt: "Yala Maha" }],
  },
  twitter: {
    card: "summary",
    title: t.meta.title,
    description: t.meta.description,
    images: ["/images/logo-icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: [{ rel: "icon", url: "/images/favicon.png" }],
};

export default function Page() {
  return <LandingPage lang="en" />;
}
