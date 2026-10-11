import type { Metadata } from "next";
import { LinkedInResultsView } from "@/components/linkedin/linkedin-results";

export const metadata: Metadata = {
  title: "Your LinkedIn profile results",
  robots: { index: false, follow: false },
};

export default function LinkedInResultsPage() {
  return <LinkedInResultsView />;
}
