import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";

export const metadata: Metadata = {
  title: "Your results",
  robots: { index: false, follow: false },
  alternates: { canonical: "/results" },
};

export default function ResultsPage() {
  return <ResultsView />;
}
