import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared Open Graph card: warm off-white backdrop, one frosted "glass" panel, Barlow Condensed
 * headline (the site's heading face) and IBM Plex Sans subline. Every opengraph-image.tsx calls
 * this with its own text. `_og` is a private folder, so nothing here becomes a route.
 *
 * Fonts are bundled TTFs (SIL Open Font License, see fonts/OFL-*.txt) because the OG renderer
 * cannot use the woff2 files next/font serves. Read once per server process.
 */
const fontDir = join(process.cwd(), "src/app/_og/fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "BarlowCondensed-Bold.ttf")),
  readFile(join(fontDir, "IBMPlexSans-Regular.ttf")),
]);

export const ogSize = { width: 1200, height: 630 };

export async function ogCard({
  eyebrow,
  title,
  subtitle,
}: {
  /** Small label above the title, e.g. "LinkedIn profile analyzer" or "Guide". */
  eyebrow: string;
  /** The headline. Keep it under ~70 characters so it fits on two or three lines. */
  title: string;
  subtitle?: string;
}) {
  const [barlow, plex] = await fonts;
  const titleSize = title.length > 52 ? 70 : title.length > 34 ? 84 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px 60px",
          background:
            "radial-gradient(760px 520px at 8% 0%, rgba(242,196,150,0.62), rgba(242,196,150,0)), radial-gradient(760px 560px at 100% 100%, rgba(214,222,196,0.75), rgba(214,222,196,0)), #faf8f4",
          color: "#1c1b19",
          fontFamily: "Plex",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontFamily: "Barlow", fontSize: 46, letterSpacing: "-0.01em" }}>
            parsewise<span style={{ color: "#7a4419" }}>.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#45413a",
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(255,254,251,0.7)",
              border: "1.5px solid rgba(255,255,255,0.95)",
            }}
          >
            Free · No sign-up · Nothing stored
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "44px 52px 48px",
            borderRadius: 32,
            background: "rgba(255,254,251,0.64)",
            border: "2px solid rgba(255,255,255,0.92)",
            boxShadow: "0 30px 60px -30px rgba(70,45,20,0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#7a4419",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontFamily: "Barlow",
              fontSize: titleSize,
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ display: "flex", marginTop: 22, fontSize: 29, lineHeight: 1.35, color: "#45413a" }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: "Barlow", data: barlow, weight: 700, style: "normal" },
        { name: "Plex", data: plex, weight: 400, style: "normal" },
      ],
    },
  );
}
