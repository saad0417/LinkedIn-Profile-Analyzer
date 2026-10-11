// Font name clean-up and classification.

const DISPLAY: Record<string, string> = {
  arial: "Arial",
  arialmt: "Arial",
  arialnarrow: "Arial Narrow",
  helvetica: "Helvetica",
  helveticaneue: "Helvetica Neue",
  times: "Times New Roman",
  timesroman: "Times New Roman",
  timesnewroman: "Times New Roman",
  timesnewromanps: "Times New Roman",
  timesnewromanpsmt: "Times New Roman",
  calibri: "Calibri",
  cambria: "Cambria",
  georgia: "Georgia",
  garamond: "Garamond",
  ebgaramond: "EB Garamond",
  verdana: "Verdana",
  tahoma: "Tahoma",
  trebuchetms: "Trebuchet MS",
  bookantiqua: "Book Antiqua",
  palatino: "Palatino",
  palatinolinotype: "Palatino Linotype",
  aptos: "Aptos",
  segoeui: "Segoe UI",
  liberationsans: "Liberation Sans",
  liberationserif: "Liberation Serif",
  liberationmono: "Liberation Mono",
  dejavusans: "DejaVu Sans",
  dejavuserif: "DejaVu Serif",
  notosans: "Noto Sans",
  notoserif: "Noto Serif",
  opensans: "Open Sans",
  roboto: "Roboto",
  sourcesanspro: "Source Sans Pro",
  montserrat: "Montserrat",
  poppins: "Poppins",
  proximanova: "Proxima Nova",
  avenir: "Avenir",
  avenirnext: "Avenir Next",
  avenirnextltpro: "Avenir Next",
  raleway: "Raleway",
  lato: "Lato",
  couriernew: "Courier New",
  courier: "Courier New",
  symbol: "Symbol",
  wingdings: "Wingdings",
  opensymbol: "OpenSymbol",
  centurygothic: "Century Gothic",
  gillsans: "Gill Sans",
  futura: "Futura",
  playfairdisplay: "Playfair Display",
  comicsansms: "Comic Sans MS",
};

/** System fonts every parser and every recruiter's machine handles well. */
const STANDARD = new Set([
  "arial", "arialnarrow", "helvetica", "helveticaneue", "timesnewroman", "calibri", "cambria", "georgia", "garamond",
  "ebgaramond", "verdana", "tahoma", "trebuchetms", "bookantiqua", "palatino", "palatinolinotype", "aptos", "segoeui",
  "liberationsans", "liberationserif", "liberationmono", "arimo", "tinos", "carlito", "caladea", "dejavusans", "dejavuserif",
  "notosans", "notoserif", "opensans", "roboto", "sourcesanspro", "sourcesans3", "couriernew", "centurygothic", "gillsans",
  "nimbussans", "nimbusroman", "constantia", "corbel", "candara", "franklingothic", "franklingothicbook", "baskerville",
  "baskervilleoldface", "didot", "optima", "lucidasans", "lucidagrande", "bookman", "bookmanoldstyle", "sylfaen",
]);

/** Decorative or web/design fonts that are not installed on typical office machines. */
const DECORATIVE = new Set([
  "montserrat", "poppins", "proximanova", "avenir", "avenirnext", "raleway", "lato", "nunito", "nunitosans",
  "playfairdisplay", "oswald", "quicksand", "comfortaa", "josefinsans", "bebasneue", "abrilfatface", "pacifico", "lobster",
  "dancingscript", "greatvibes", "comicsansms", "papyrus", "brushscriptmt", "futura", "worksans", "dmsans", "manrope",
  "mulish", "rubik", "ubuntu", "firasans", "barlow", "karla", "cabin", "archivo", "spacegrotesk", "spacemono",
  "lora", "merriweather", "ptsans", "ptserif", "librebaskerville", "cormorantgaramond", "sourceserifpro", "inter",
  "ibmplexsans", "ibmplexserif", "jost", "outfit", "sora", "urbanist", "lexend", "satisfy", "caveat", "amatic",
  "amaticsc", "shadowsintolight", "indieflower", "permanentmarker", "righteous", "alegreya", "crimsontext", "kanit",
]);

/** Glyph / icon fonts: their characters are pictures, not text. */
const SYMBOL = new Set([
  "symbol", "wingdings", "wingdings2", "wingdings3", "webdings", "opensymbol", "fontawesome", "fontawesome5free",
  "fontawesome5brands", "fontawesome6free", "fontawesome6brands", "materialicons", "materialsymbols", "zapfdingbats",
  "dingbats", "segoeuisymbol", "segoemdl2assets", "starsymbol", "mtextra", "bootstrapicons", "ionicons",
]);

export function fontKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Reduce a raw PDF/DOCX font name to its family:
 * "ABCDEF+Montserrat-Bold" → "Montserrat", "TimesNewRomanPS-BoldMT" → "Times New Roman",
 * "Calibri,Bold" → "Calibri".
 */
export function cleanFontName(raw: string): string | null {
  let s = raw.trim().replace(/^[A-Z]{6}\+/, "");
  if (!s) return null;
  if (/^(g_d\d+_f\d+|f\d+|t\d+_\d+|tt\d+)$/i.test(s)) return null; // anonymous ids
  s = s.split(/[,]/)[0];
  if (!/\s/.test(s)) s = s.split("-")[0];
  if (DISPLAY[fontKey(s)]) return DISPLAY[fontKey(s)];
  const base = s;
  s = s
    .replace(/(PSMT|PS|MT)$/g, "")
    .replace(/(Bold|Italic|Oblique|Regular|Light|Medium|SemiBold|Semibold|DemiBold|Demi|Black|Heavy|Thin|ExtraLight|ExtraBold|Condensed|Cond)+$/g, (m) =>
      m === base ? m : "",
    )
    .replace(/(PSMT|PS|MT)$/g, "")
    .trim();
  if (!s) return null;
  const key = fontKey(s);
  if (DISPLAY[key]) return DISPLAY[key];
  if (/\s/.test(s)) return s;
  // CamelCase → spaced words ("ProximaNova" → "Proxima Nova").
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

export type FontClass = "standard" | "decorative" | "symbol" | "other";

export function classifyFont(family: string): FontClass {
  const k = fontKey(family);
  if (SYMBOL.has(k) || /icons?$|awesome|dingbat/.test(k)) return "symbol";
  if (DECORATIVE.has(k)) return "decorative";
  if (STANDARD.has(k)) return "standard";
  return "other";
}

export const RECOMMENDED_FONTS = ["Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Helvetica", "Times New Roman"];
