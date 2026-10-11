// Extra resume fixtures drawn directly with pdf-lib (no LibreOffice needed).
//   npx tsx scripts/build-extra-fixtures.ts
// 22-long-three-page-us.pdf: a three-page CV with a street address, an
// over-long summary, paragraph-length bullets, noun-first bullets and no
// Skills section. Exercises content.length / bullet-length / summary /
// location / skills / action-verbs. All people and companies are fictional.
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "fixtures");

async function main() {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const X = 54;
  const WIDTH = W - 2 * X;
  let page = doc.addPage([W, 792]);
  let y = 740;

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const out: string[] = [];
    let cur = "";
    for (const w of text.split(" ")) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && font.widthOfTextAtSize(next, size) > width) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const line = (text: string, size = 10.5, font = reg, x = X, gap = 0) => {
    y -= gap;
    for (const l of wrap(text, font, size, WIDTH - (x - X))) {
      if (y - size * 1.3 < 60) {
        page = doc.addPage([W, 792]);
        y = 740;
      }
      y -= size * 1.3;
      page.drawText(l, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    }
  };
  const bullet = (text: string) => {
    const lines = wrap(text, reg, 10.5, WIDTH - 14);
    lines.forEach((l, i) => {
      if (y - 10.5 * 1.3 < 60) {
        page = doc.addPage([W, 792]);
        y = 740;
      }
      y -= 10.5 * 1.3;
      if (i === 0) page.drawText("•", { x: X + 2, y, size: 10.5, font: reg });
      page.drawText(l, { x: X + 14, y, size: 10.5, font: reg });
    });
  };
  const heading = (t: string) => line(t.toUpperCase(), 12, bold, X, 12);

  line("Gregory Lindqvist", 22, bold);
  line("4127 Maple Grove Avenue, Minneapolis, MN 55410  |  (612) 555-0193  |  greg.lindqvist@example.com", 10, reg, X, 4);

  heading("Summary");
  line(
    "Seasoned operations and supply chain leader with more than twenty years of progressive experience across manufacturing, distribution and third-party logistics environments, " +
      "known for building high-performing teams, driving continuous improvement culture, partnering cross-functionally with finance, procurement and sales leadership, and translating " +
      "corporate strategy into practical day-to-day execution on the shop floor. Deep expertise in lean manufacturing, Six Sigma methodologies, sales and operations planning, " +
      "warehouse management systems, transportation management, vendor negotiations and capital project management. Recognised for a calm, steady leadership style, strong " +
      "communication skills and an ability to manage competing priorities in fast-paced, high-volume environments while keeping safety, quality and customer satisfaction at the centre " +
      "of every decision made across the organisation. Outside of work, active mentor for first-time supervisors through a regional manufacturing association, " +
      "volunteer with a local food bank's logistics committee, and frequent speaker at industry events on topics such as workforce development, automation readiness and resilient supply networks.",
  );

  heading("Professional Experience");
  const roles: { head: string; bullets: string[] }[] = [];
  const longB = (topic: string) =>
    `Oversight of ${topic} across multiple sites, including day-to-day coordination with plant managers, quality leads and finance business partners, weekly reporting to the executive team, budget ownership, ` +
    `vendor relationships, staffing plans, safety programmes and the continuous improvement roadmap for the coming fiscal years.`;
  roles.push({
    head: "Director of Operations, Northstar Components Inc. — Minneapolis, MN   Jan 2016 – Present",
    bullets: [
      longB("production planning"),
      longB("warehouse operations"),
      "Led a plant consolidation that cut annual operating costs by $4.2M.",
      longB("transportation and freight"),
      "Implementation of a new warehouse management system at three distribution centres with 300 staff.",
      longB("supplier quality"),
      "Reduced recordable safety incidents by 38% over three years.",
      longB("capital projects"),
      longB("inventory accuracy"),
    ],
  });
  roles.push({
    head: "Senior Operations Manager, Lakeshore Packaging Co. — St. Paul, MN   Mar 2009 – Dec 2015",
    bullets: [
      longB("packaging lines"),
      "Responsibility for a team of 140 production associates on three shifts.",
      longB("maintenance planning"),
      "Grew on-time delivery from 88% to 97%.",
    ],
  });
  roles.push({
    head: "Operations Manager, Twin Rivers Distribution — Bloomington, MN   Jun 2003 – Feb 2009",
    bullets: [longB("inbound receiving"), "Ownership of the cross-dock programme for the largest retail customer.", longB("outbound shipping")],
  });
  roles.push({
    head: "Production Supervisor, Prairie Metalworks — Eden Prairie, MN   Aug 1999 – May 2003",
    bullets: [longB("second-shift production"), "Supervision of 35 machinists and assemblers.", longB("tooling changeovers")],
  });
  roles.push({
    head: "Manufacturing Engineer, Prairie Metalworks — Eden Prairie, MN   Jun 1997 – Jul 1999",
    bullets: [longB("process documentation"), longB("fixture design"), "Cut scrap on the main stamping line by 22%."],
  });
  roles.push({
    head: "Engineering Co-op, Cedar Valley Plastics — Mankato, MN   May 1996 – May 1997",
    bullets: [longB("mould trials"), longB("line balancing studies"), longB("quality inspection records")],
  });
  for (const r of roles) {
    line(r.head, 11, bold, X, 8);
    for (const b of r.bullets) bullet(b);
  }

  heading("Education");
  line("University of Minnesota — B.S. Industrial Engineering, 1999", 10.5, reg, X, 4);
  heading("Certifications");
  line("Lean Six Sigma Black Belt (ASQ), 2012", 10.5, reg, X, 4);
  line("APICS Certified Supply Chain Professional (CSCP), 2014", 10.5, reg, X, 0);

  const file = join(OUT, "22-long-three-page-us.pdf");
  writeFileSync(file, await doc.save({ useObjectStreams: false }));
  console.log(`wrote ${file} (${doc.getPageCount()} pages)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
