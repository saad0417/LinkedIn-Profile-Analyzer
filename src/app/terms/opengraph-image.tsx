import { ogCard } from "@/app/_og/card";

export const alt = "Parsewise terms of use";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Terms of use",
    title: "The short version.",
    subtitle: "The terms for using Parsewise's free resume and LinkedIn tools.",
  });
}
