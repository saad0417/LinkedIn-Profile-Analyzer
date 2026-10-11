import Link from "next/link";
import { GuideArticle, guideMetadata } from "@/components/guide-article";

export const metadata = guideMetadata("resume-keywords");

export default function Page() {
  return (
    <GuideArticle slug="resume-keywords" readMinutes={6}>
      <p>
        &ldquo;Add keywords&rdquo; is the most common resume advice and the most misunderstood. Done well, it makes
        sure a recruiter&apos;s search finds you. Done badly, it produces a resume that reads like a tag cloud and
        loses the human reader in the first ten seconds.
      </p>

      <h2>How recruiters actually search</h2>
      <p>
        Inside an applicant tracking system, a recruiter types what they need: usually a job title and a handful of
        hard requirements. &ldquo;Data analyst&rdquo; and &ldquo;SQL&rdquo; and &ldquo;Tableau&rdquo;. The system
        returns candidates whose parsed resume contains those words. Some systems handle synonyms; many match
        fairly literally.
      </p>
      <p>
        So the keywords that matter most are the ones a recruiter would type into a search box, not every
        adjective in the posting.
      </p>

      <h2>Which words in a posting matter</h2>
      <h3>1. The job title</h3>
      <p>
        If you have done this job under a slightly different title, consider using the posting&apos;s wording
        where it is accurate, for example in your summary: &ldquo;Product analyst with five years…&rdquo;. Never
        change the title of a past role to something you didn&apos;t hold.
      </p>
      <h3>2. Hard skills</h3>
      <p>
        Tools, technologies, methods, certifications, licences, languages. These are the most searched terms and the
        easiest to verify. Write them the way the posting does: if it says &ldquo;Google Analytics 4&rdquo;, don&apos;t
        only write &ldquo;GA&rdquo;.
      </p>
      <h3>3. Repeated phrases</h3>
      <p>
        If a posting mentions &ldquo;stakeholder management&rdquo; three times, it matters to whoever wrote it.
        Repetition in the posting is a better signal than any keyword list.
      </p>
      <h3>4. Soft skills, last</h3>
      <p>
        &ldquo;Communication&rdquo; and &ldquo;team player&rdquo; are rarely searched for. Show them in a bullet
        instead of listing them.
      </p>

      <h2>Where to put keywords</h2>
      <ul>
        <li>
          <strong>In experience bullets</strong>, where they prove use: &ldquo;Built weekly revenue dashboards in
          Tableau used by 40 account managers.&rdquo;
        </li>
        <li>
          <strong>In a plain-text skills section</strong>, as a comma-separated list. Not a grid, not a chart.
        </li>
        <li>
          <strong>In your summary</strong>, for the job title and the two or three central skills.
        </li>
      </ul>

      <h2>What not to do</h2>
      <ul>
        <li>Don&apos;t add skills you don&apos;t have. Interviews find out, and so do reference checks.</li>
        <li>Don&apos;t paste the job description in white text. Parsers extract it, recruiters see it, and it ends the application.</li>
        <li>Don&apos;t repeat a keyword ten times. Matching is mostly presence, not frequency.</li>
      </ul>

      <h2>Finding your gaps quickly</h2>
      <p>
        <Link href="/#check">Paste a job description alongside your resume</Link> and our checker lists the
        posting&apos;s hard skills and repeated phrases, counts how often each appears in both documents, and
        flags whether the job title appears in yours. Add the ones that are true for you, ideally inside a bullet
        that shows you using them.
      </p>
      <p>
        Before any of that, make sure your resume parses: a keyword in a text box or a sidebar may not be searchable
        at all. Our <Link href="/guides/ats-resume-format">formatting guide</Link> explains why.
      </p>
    </GuideArticle>
  );
}
