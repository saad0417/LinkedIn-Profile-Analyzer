// Action verbs for "does this bullet start with what you did?". Shared by the
// resume checks and the LinkedIn rubric. Base forms; isActionVerb() accepts the
// usual inflections (led/leads/leading are handled via IRREGULAR + suffix rules).

const BASE = `
accelerate achieve acquire adapt address administer advance advise advocate align allocate analyse analyze anchor
answer apply appraise approve arbitrate architect arrange assemble assess attain audit author authorize automate
balance benchmark boost brief broker budget build calculate campaign capture catalogue categorize centralize chair
champion chart clarify close coach co-author co-found code collaborate collect combine command commission communicate
compile complete compose compute conceive conceptualize conduct configure consolidate construct consult contract
control convert convince coordinate correct counsel craft create cultivate curate customize cut debug decrease
define delegate deliver demonstrate deploy design detect determine develop devise diagnose digitize direct discover
dispatch distribute document double draft drive earn edit educate eliminate enable encourage engineer enhance enlarge
enrich ensure establish estimate evaluate examine exceed execute expand expedite experiment extend extract
facilitate finalize finance forecast forge form formulate found foster gather generate govern grow guide halve
handle harmonize head hire host identify illustrate implement improve increase influence inform initiate innovate
inspect inspire install institute instruct integrate interpret interview introduce invent investigate join justify
launch lead lecture leverage liaise license lift localize lower maintain manage map market master maximize measure
mediate mentor merge migrate minimize mobilize model moderate modernize monitor motivate navigate negotiate nurse
onboard open operate optimise optimize orchestrate order organise organize originate outperform overhaul oversee
own partner perform persuade pilot pioneer pitch plan prepare present preserve prevent prioritize process procure
produce program programme promote propose prospect protect prototype provide publish purchase qualify quantify
raise rank rationalize reach rebuild recommend reconcile record recover recruit redesign reduce re-engineer refactor
refine reform regulate rehabilitate reinforce relaunch remediate remodel renegotiate reorganize repair replace report
represent research resolve restore restructure retain revamp review revise revitalize rewrite roll save scale
schedule scope screen secure segment select sell serve set shape ship showcase simplify solve source spearhead
specify speed sponsor stabilize standardize start steer streamline strengthen structure supervise supply support
survey sustain synthesize systematize tailor target teach test track train transform transition translate treat
triage triple troubleshoot turn uncover unify update upgrade validate verify visualize volunteer win write
book care shorten scrape precept answer greet stock clean cook prepare fix replace install load deliver drive
assist help handle tutor counsel nurse administer dispense process file greet welcome ensure check host
publish present speak reach close sell upsell cross-sell generate prospect qualify negotiate renew retain grow
`;

/**
 * Words ending in -ed that open a bullet as an adjective, not as what you did
 * ("Experienced in…", "Skilled at…"). Any other -ed word is accepted as a past-tense verb.
 */
const ED_ADJECTIVES = new Set(
  "experienced skilled detailed dedicated motivated talented qualified certified licensed seasoned accomplished committed focused results-oriented self-motivated highly-motivated passionate interested involved used tasked assigned required expected".split(" "),
);

/** Irregular past forms and other one-offs. */
const IRREGULAR = `
led built ran won grew drove wrote made set cut taught sold spoke began brought chose oversaw undertook kept held
found gave became rebuilt sped spun shrank met thought bought drew rewrote overtook outgrew upheld withheld
co-led co-wrote co-founded co-authored
`;

const BASE_SET = new Set(BASE.split(/\s+/).filter(Boolean));
const IRREGULAR_SET = new Set(IRREGULAR.split(/\s+/).filter(Boolean));

function candidates(w: string): string[] {
  const out = [w];
  if (w.endsWith("ies")) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("ied")) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("es")) out.push(w.slice(0, -2));
  if (w.endsWith("s")) out.push(w.slice(0, -1));
  if (w.endsWith("ed")) {
    out.push(w.slice(0, -2), w.slice(0, -1));
    // planned → plan, shipped → ship
    if (/([b-df-hj-np-tv-z])\1ed$/.test(w)) out.push(w.slice(0, -3));
  }
  if (w.endsWith("ing")) {
    out.push(w.slice(0, -3), w.slice(0, -3) + "e");
    if (/([b-df-hj-np-tv-z])\1ing$/.test(w)) out.push(w.slice(0, -4));
  }
  return out;
}

/** True when `word` (any case, trailing punctuation ignored) is an action verb in a common form. */
export function isActionVerb(word: string): boolean {
  const w = word.toLowerCase().replace(/[^\p{L}-]/gu, "");
  if (!w) return false;
  if (IRREGULAR_SET.has(w)) return true;
  if (ED_ADJECTIVES.has(w)) return false;
  // "leading", "leads" etc. derive from BASE "lead".
  if (candidates(w).some((c) => BASE_SET.has(c))) return true;
  // Regular past tense not in the list ("Shortened", "Booked").
  return /^\p{L}{3,}(?:[^e]ed|eed)$/u.test(w) || /^\p{L}{2,}[^aeiou]ed$/u.test(w) || /^\p{L}{3,}ied$/u.test(w) || /^\p{L}{3,}ated$/u.test(w);
}

/** First word of a bullet, after any bullet glyph or numbering. */
export function firstWord(text: string): string {
  return (
    text
      .replace(/^[^\p{L}]+/u, "")
      .split(/\s+/)[0]
      ?.replace(/[^\p{L}-]+$/u, "") ?? ""
  );
}
