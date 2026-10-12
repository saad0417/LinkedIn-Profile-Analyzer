import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata("Your results");

export default function ResultsPage() {
  return <ResultsView />;
}
