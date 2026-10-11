import Link from "next/link";
import { GuideArticle, guideMetadata } from "@/components/guide-article";

export const metadata = guideMetadata("ats-resume-format");

export default function Page() {
  return (
    <GuideArticle slug="ats-resume-format" readMinutes={7}>
      <p>
        An applicant tracking system does two jobs with your resume. First it <strong>parses</strong> it: pulls
        out your name, contact details, each job with its title, employer and dates, your education and your
        skills, and stores them as separate fields. Then recruiters <strong>search</strong> those fields.
      </p>
      <p>
        Formatting matters because of the first step. If a field is parsed wrongly, it is stored wrongly, and a
        search that should have found you doesn&apos;t. Nothing tells you it happened. Here is what breaks
        parsing, roughly in order of how much damage it does.
      </p>

      <h2>1. Make sure there is text to read</h2>
      <p>
        A resume exported as an image, or a scanned page saved as a PDF, contains no text at all. The parser
        extracts nothing, and your application is an empty record with a file attached. Export from Word,
        Google Docs or Pages using <em>Save as PDF</em> or <em>Download as PDF</em>, never by printing to an
        image or photographing a page.
      </p>
      <p>
        A quick test: open your PDF and try to select a sentence with your cursor. If you can&apos;t, a parser
        can&apos;t either.
      </p>

      <h2>2. Use one column</h2>
      <p>
        Most parsers read the page the way a typewriter would: left to right, one line at a time. A two-column
        layout puts your sidebar and your main column on the same lines, so they are joined together. Skills
        become part of job titles; dates attach to the wrong role.
      </p>
      <p>
        Right-aligned dates on the same line as a job title are fine. That is still one column of content.
        What causes trouble is two independent streams of text side by side.
      </p>

      <h2>3. Keep tables and text boxes out of the layout</h2>
      <p>
        Many &ldquo;modern&rdquo; templates use borderless tables to line dates up against titles, or text boxes
        to place a name or a skills panel. You can&apos;t see the table, but the parser can. Cell relationships
        are often discarded, so titles, companies and dates are shuffled. Content in text boxes and shapes is
        frequently skipped altogether.
      </p>
      <p>
        Use ordinary paragraphs. For a date on the right of a title, use a right-aligned tab stop instead of a
        table.
      </p>

      <h2>4. Put your contact details in the body</h2>
      <p>
        Word&apos;s header and footer areas are a tidy place for a name and phone number, and many parsers
        ignore them entirely because they read only the main body of the document. Your email and phone come back
        empty, and a recruiter who likes your profile has no way to reach you. Put them in the first lines of the
        page itself.
      </p>

      <h2>5. Use headings a parser expects</h2>
      <p>
        Parsers find sections by matching headings against a dictionary. These are safe:
      </p>
      <table>
        <thead>
          <tr>
            <th>Use</th>
            <th>Avoid</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Experience, Work Experience</td><td>My Journey, Where I&apos;ve Been</td></tr>
          <tr><td>Education</td><td>Learning, Academic Adventures</td></tr>
          <tr><td>Skills, Technical Skills</td><td>What I Bring, Toolbox</td></tr>
          <tr><td>Summary, Professional Summary</td><td>About Me, Hello</td></tr>
          <tr><td>Certifications</td><td>Badges, Credentials Earned</td></tr>
        </tbody>
      </table>

      <h2>6. Write dates the same way every time</h2>
      <p>
        Systems calculate time in each role from your dates. <code>03/2021 – Present</code> or{" "}
        <code>March 2021 – Present</code> both work, used consistently. Years on their own (<code>2019 – 2021</code>)
        make durations ambiguous, and mixing formats in one document invites errors.
      </p>

      <h2>7. Drop graphics that carry meaning</h2>
      <p>
        Skill bars, rating dots, pie charts and icon-only contact rows are pictures. A parser can&apos;t read
        &ldquo;four out of five dots&rdquo; as fluency in Spanish, and an envelope icon is not an email address.
        Write the information as text.
      </p>

      <h2>8. Choose a font the server has</h2>
      <p>
        Fonts like Montserrat, Poppins, Proxima Nova and Avenir look sharp on your machine but may not exist on
        the system that processes your file, which can garble characters in some conversions. Calibri, Arial,
        Helvetica, Georgia, Cambria and Times New Roman are safe.
      </p>

      <h2>PDF or Word?</h2>
      <p>
        Either works if it is a real text document. Word files are easiest for parsers and recruiters to edit;
        PDFs keep your layout exactly as designed. If a posting asks for one, send that. Otherwise, a clean
        text-based PDF is fine.
      </p>

      <h2>What about length?</h2>
      <p>
        Two pages perform as well as one at every career stage, so don&apos;t cut real experience to hit one
        page. Cut padding instead: duties without results, very short bullets, and the same verb repeated down
        the page.
      </p>

      <h2>Check your own file</h2>
      <p>
        Everything above can be tested automatically. <Link href="/#check">Upload your resume</Link> and you&apos;ll
        see each problem quoted from your own document, beside the record a parser would store. If you&apos;d
        rather start clean, our <Link href="/templates">ATS-friendly templates</Link> follow every rule on this
        page.
      </p>
    </GuideArticle>
  );
}
