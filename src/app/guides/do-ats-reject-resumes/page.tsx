import Link from "next/link";
import { GuideArticle, guideMetadata } from "@/components/guide-article";

export const metadata = guideMetadata("do-ats-reject-resumes");

export default function Page() {
  return (
    <GuideArticle slug="do-ats-reject-resumes" readMinutes={6}>
      <p>
        You&apos;ve probably read that &ldquo;75% of resumes are rejected by robots before a human sees them.&rdquo;
        It is one of the most repeated claims in job-search advice, and there is no solid study behind it. The
        reality is less dramatic and, in one way, more worrying.
      </p>

      <h2>What an ATS actually does</h2>
      <p>
        An applicant tracking system is a database and a workflow tool. It collects applications for a job,
        stores each candidate&apos;s details, and lets a recruiter move people through stages: screened,
        interviewed, offered. Most of the decisions are still made by people.
      </p>
      <p>
        Many widely used systems don&apos;t score or rank applicants by default at all. Greenhouse, for example,
        is explicit that it doesn&apos;t automatically reject or rank resumes. When recruiters are surveyed, most
        say their system does not reject candidates for formatting or content.
      </p>

      <h2>So where do automatic rejections come from?</h2>
      <p>
        Mostly from <strong>knockout questions</strong> the employer sets up: &ldquo;Do you have the right to work
        in this country?&rdquo;, &ldquo;Do you hold this licence?&rdquo;, &ldquo;Are you willing to relocate?&rdquo;
        Answer no to a required one and you may be screened out. That is a rule the recruiter chose, applied to
        your answers, not a judgement of your resume.
      </p>
      <p>
        Some employers do switch on ranking or AI matching features. When they do, those features work on the
        fields that were parsed from your resume, which brings us to the real problem.
      </p>

      <h2>The real risk: you don&apos;t come up in search</h2>
      <p>
        Recruiters rarely read every application in order. For a busy role they search: a job title, a skill, a
        certification, a location. They also search their whole database when a new role opens, including
        people who applied for something else months ago.
      </p>
      <p>
        Search runs on the parsed fields. If your resume parsed badly, those fields are wrong or empty:
      </p>
      <ul>
        <li>a phone number and email in the page header, never read, so the contact fields are empty;</li>
        <li>a two-column layout, so your skills sidebar is stitched into your job titles;</li>
        <li>dates in a layout table, so your experience can&apos;t be calculated;</li>
        <li>a heading called &ldquo;My Journey&rdquo;, so your work history isn&apos;t recognised as experience.</li>
      </ul>
      <p>
        None of these produce a rejection email. You just don&apos;t appear in the results, for this role or the
        next one. That&apos;s why it&apos;s worth checking: the failure is silent.
      </p>

      <h2>What this means for your resume</h2>
      <ol>
        <li>
          <strong>Make it parse cleanly.</strong> One column, real text, contact details in the body, standard
          headings, consistent dates. Our <Link href="/guides/ats-resume-format">ATS formatting guide</Link>{" "}
          covers each rule.
        </li>
        <li>
          <strong>Use the words recruiters search for.</strong> The job&apos;s title and the hard skills it names,
          written the way the posting writes them, where they are true for you. See{" "}
          <Link href="/guides/resume-keywords">matching keywords honestly</Link>.
        </li>
        <li>
          <strong>Then write for the human.</strong> Once a recruiter finds you, quantified, specific bullets are
          what make them keep reading.
        </li>
      </ol>

      <h2>Be careful with &ldquo;ATS scores&rdquo;</h2>
      <p>
        A single score out of 100 for &ldquo;ATS compatibility&rdquo;, calculated without a job description,
        isn&apos;t measuring anything a real system does. It&apos;s more useful to see two things you can verify:
        whether your content survives parsing, and how closely it matches a specific posting.{" "}
        <Link href="/#check">Our checker</Link> reports exactly those, and shows you the parsed record so you can
        judge for yourself.
      </p>
    </GuideArticle>
  );
}
