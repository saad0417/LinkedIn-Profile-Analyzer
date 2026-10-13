import { ogCard } from "@/app/_og/card";

export const alt = "Parsewiser terms of use";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Terms of use",
    title: "The short version.",
    subtitle: "The terms for using Parsewiser's free resume and LinkedIn tools.",
  });
}
