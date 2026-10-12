import type { Metadata } from "next";
import { BuilderView } from "@/components/builder/builder-view";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/builder",
  title: "ATS-Friendly Resume Builder: Free, No Sign-up",
  socialTitle: "Free ATS-friendly resume builder",
  description:
    "Free ATS-friendly resume builder. Turn your own notes into clear, parser-safe bullets, pick a clean template and download Word or PDF. No sign-up needed.",
  keywords: ["ATS friendly resume builder", "free resume builder", "AI resume builder", "resume builder Word PDF"],
});

export default function BuilderPage() {
  return <BuilderView />;
}
