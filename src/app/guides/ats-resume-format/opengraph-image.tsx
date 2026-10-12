import { ogCard } from "@/app/_og/card";
import { guides } from "@/lib/site";

const guide = guides.find((g) => g.slug === "ats-resume-format")!;

export const alt = guide.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({ eyebrow: "Guide · " + guide.short, title: guide.title });
}
