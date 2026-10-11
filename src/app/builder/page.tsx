import type { Metadata } from "next";
import { BuilderView } from "@/components/builder/builder-view";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free ATS-Friendly Resume Builder with AI",
  description:
    "Build an ATS-friendly resume from your own notes. Enter the role you want, your experience and skills; AI writes clear bullets without inventing anything. Choose a template and download Word or PDF.",
  alternates: { canonical: "/builder" },
  openGraph: { url: "/builder", title: `Free ATS-Friendly Resume Builder | ${site.name}` },
};

export default function BuilderPage() {
  return <BuilderView />;
}
