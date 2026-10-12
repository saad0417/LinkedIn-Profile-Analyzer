import { ogCard } from "@/app/_og/card";

export const alt = "Parsewise ATS-friendly resume builder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Resume builder",
    title: "Build an ATS-friendly resume.",
    subtitle: "Your own notes turned into clear, parser-safe bullets. Pick a template, download Word or PDF.",
  });
}
