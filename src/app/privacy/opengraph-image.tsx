import { ogCard } from "@/app/_og/card";

export const alt = "Parsewiser privacy policy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Privacy policy",
    title: "Your files are never stored.",
    subtitle: "Processed in memory, discarded when your results come back.",
  });
}
