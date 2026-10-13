import { ogCard } from "@/app/_og/card";

export const alt = "Parsewiser guides to how applicant tracking systems read resumes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Guides",
    title: "How resumes are really read.",
    subtitle: "Plain-English guides to ATS parsing, formatting and keywords.",
  });
}
