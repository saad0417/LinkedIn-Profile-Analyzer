import type { Metadata } from "next";
import { LinkedInResultsView } from "@/components/linkedin/linkedin-results";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata("Your LinkedIn profile results");

export default function LinkedInResultsPage() {
  return <LinkedInResultsView />;
}
