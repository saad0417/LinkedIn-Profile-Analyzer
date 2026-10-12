import { ogCard } from "@/app/_og/card";

export const alt = "Parsewise LinkedIn profile analyzer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "LinkedIn profile analyzer",
    title: "Score your LinkedIn profile, then fix it.",
    subtitle: "Upload your profile PDF for a score out of 100 and specific fixes, section by section.",
  });
}
