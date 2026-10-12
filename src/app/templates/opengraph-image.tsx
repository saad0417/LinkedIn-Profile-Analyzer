import { ogCard } from "@/app/_og/card";

export const alt = "Free ATS-friendly resume templates from Parsewise";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Resume templates",
    title: "Resume templates that get past the parser.",
    subtitle: "Free ATS-safe designs in Word and PDF: single column, real text, clean parsing.",
  });
}
