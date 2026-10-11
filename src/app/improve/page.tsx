import type { Metadata } from "next";
import { ImproveView } from "@/components/improve/improve-view";

export const metadata: Metadata = {
  title: "Improve your resume",
  robots: { index: false, follow: false },
};

export default function ImprovePage() {
  return <ImproveView />;
}
