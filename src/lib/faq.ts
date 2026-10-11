export const faq: { q: string; a: string }[] = [
  {
    q: "Is this ATS resume checker really free?",
    a: "Yes. Uploading, the parser view, every check, the scores and the job description match are free with no sign-up. The optional AI rewrites are free too, within a daily limit.",
  },
  {
    q: "Do applicant tracking systems automatically reject resumes?",
    a: "Mostly, no. Many widely used systems, Greenhouse among them, do not score or rank resumes at all, and most recruiters say their system does not auto-reject on formatting. The real risk is quieter: when a resume parses badly, its fields are stored empty or scrambled, so it never comes up when a recruiter searches the database for a title or skill.",
  },
  {
    q: "What is a good ATS score?",
    a: "Be wary of any single 'ATS score' calculated without a job description: there is no industry standard behind it. We report two things you can verify. Parse Integrity measures how much of your resume survives extraction, and above 85 means it parses cleanly. Job Match is only shown when you paste a job description, and compares your resume against that one posting.",
  },
  {
    q: "Can an ATS read a PDF resume?",
    a: "Usually, yes, if the PDF was exported from a word processor and contains real text. A PDF that is a scan or an image has no text to extract, which is the most damaging problem a resume can have. Our first check tells you which kind you have.",
  },
  {
    q: "Should my resume be one page or two?",
    a: "Two pages perform as well as one at every level of seniority, so we never penalise length on its own. We do flag padding: very short bullets, repeated phrasing and vague duties that take space without saying anything.",
  },
  {
    q: "Why does a two-column resume cause problems?",
    a: "Most parsers read a page from left to right, line by line. With two columns, each line of your sidebar gets joined to the line beside it in the main column, so dates, job titles and skills end up mixed together. Upload one and switch to 'Raw text' in the results to see exactly what happens.",
  },
  {
    q: "Is my resume stored or shared?",
    a: "No. The file is read in memory on our server, analysed, and discarded as soon as your results are sent back. Nothing is written to disk and there is no database. Your results live only in your browser tab and are cleared when you close it.",
  },
  {
    q: "Does the AI make up achievements?",
    a: "It is instructed not to, and the rewrites are built to make that visible. When a bullet would be stronger with a number, the rewrite inserts a [metric] placeholder for you to fill in rather than inventing one. Scores never use AI, so the same file always gets the same result.",
  },
  {
    q: "Which file types can I upload?",
    a: "PDF and Word (.docx), up to 5 MB. Older .doc files need to be re-saved as .docx first. We check the file's contents rather than trusting its extension.",
  },
];
