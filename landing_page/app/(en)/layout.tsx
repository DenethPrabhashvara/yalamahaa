import type { Metadata } from "next";
import type { ReactNode } from "react";
import RootShell from "../../components/landing/RootShell";
import { getSiteUrl } from "../../lib/seo";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
};

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>;
}
