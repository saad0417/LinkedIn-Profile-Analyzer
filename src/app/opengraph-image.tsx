import { ogCard } from "@/app/_og/card";

export const alt = "Parsewiser: see your resume the way the ATS sees it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Free ATS resume checker",
    title: "See your resume the way the ATS sees it.",
    subtitle: "Upload a PDF or Word file and see what the parser extracts, what it drops and how to fix it.",
  });
}
