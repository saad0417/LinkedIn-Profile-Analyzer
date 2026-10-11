// Section heading dictionary. Matching is case-insensitive, ignores a trailing
// colon and treats "&" and "and" alike.
import type { SectionKind } from "@/lib/types";

const DICT: Record<Exclude<SectionKind, "other">, string[]> = {
  summary: [
    "summary", "professional summary", "career summary", "executive summary", "profile", "professional profile",
    "personal profile", "career profile", "objective", "career objective", "professional objective", "personal statement",
    "summary of qualifications", "qualifications summary", "overview", "professional overview", "career highlights",
    "key achievements", "highlights", "achievements",
  ],
  experience: [
    "experience", "work experience", "professional experience", "employment", "employment history", "work history",
    "career history", "relevant experience", "experience and achievements", "professional background", "career experience",
    "internships", "internship", "internship experience", "work and internship experience", "industry experience",
    "teaching experience", "research experience", "clinical experience", "military experience", "professional history",
  ],
  education: [
    "education", "academic background", "education and training", "educational background", "academic qualifications",
    "qualifications", "education and qualifications", "academic history", "academics", "education history", "training",
  ],
  skills: [
    "skills", "technical skills", "core competencies", "key skills", "competencies", "skills and abilities",
    "areas of expertise", "expertise", "skills and expertise", "core skills", "professional skills", "technologies",
    "tools", "tools and technologies", "technical proficiencies", "skills and tools", "skills summary", "it skills",
    "computer skills", "hard skills", "soft skills", "skill set", "skillset", "technical expertise", "key competencies",
  ],
  certifications: [
    "certifications", "certification", "certificates", "licenses", "licences", "licenses and certifications",
    "licences and certifications", "certifications and licenses", "certifications and licences", "professional certifications",
    "accreditations", "professional qualifications", "certifications and training", "courses", "courses and certifications",
  ],
  projects: ["projects", "personal projects", "key projects", "selected projects", "academic projects", "project experience", "portfolio", "side projects"],
};

const OTHER = [
  "languages", "language skills", "awards", "honours", "honors", "awards and honours", "awards and honors", "honors and awards",
  "honours and awards", "publications", "volunteer", "volunteering", "volunteer experience", "volunteer work", "community involvement",
  "interests", "hobbies", "hobbies and interests", "interests and hobbies", "references", "referees", "activities",
  "extracurricular activities", "leadership", "leadership experience", "memberships", "professional memberships", "affiliations",
  "professional affiliations", "contact", "contact information", "contact details", "personal details", "personal information",
  "presentations", "conferences", "talks", "patents", "research", "additional information", "additional", "other",
  "links", "social", "online presence", "speaking", "publications and talks",
];

const MAP = new Map<string, SectionKind>();
for (const [kind, list] of Object.entries(DICT) as [SectionKind, string[]][]) for (const h of list) MAP.set(h, kind);
for (const h of OTHER) MAP.set(h, "other");

export function normaliseHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\s:.\-–—|•·_]+$/g, "")
    .replace(/^[\s\-–—|•·_#]+/g, "")
    .replace(/[^\p{L}\p{N}\s/]/gu, " ")
    .replace(/\s*\/\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dictionary lookup. Returns undefined when the text is not a known heading. */
export function lookupHeading(text: string): SectionKind | undefined {
  const n = normaliseHeading(text);
  if (!n || n.length > 48) return undefined;
  return MAP.get(n);
}

/** Phrases typical of "creative" headings that parsers do not recognise. */
export const CREATIVE_HEADING = /^(?:my |what i |where i |how i |things i |who i |why i |about me\b|hello|hi,? i|get in touch|let'?s (?:talk|connect)|say hello|the (?:story|journey)|toolbox|my toolbox|superpowers|life story|journey\b|beyond work|when i'?m not)/i;

export const KIND_LABEL: Record<SectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  other: "Other",
};
