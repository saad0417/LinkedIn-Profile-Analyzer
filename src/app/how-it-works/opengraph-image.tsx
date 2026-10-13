import { ogCard } from "@/app/_og/card";

export const alt = "How Parsewiser scores a resume";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Method",
    title: "How our ATS resume scoring works.",
    subtitle: "Every check, what it looks for and how much it weighs. No AI in the score.",
  });
}
