import type { Metadata } from "next";
import { ImproveView } from "@/components/improve/improve-view";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata("Improve your resume");

export default function ImprovePage() {
  return <ImproveView />;
}
