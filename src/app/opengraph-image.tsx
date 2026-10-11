import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Parsewise: see your resume the way the ATS sees it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ancola = await readFile(join(process.cwd(), "src/app/fonts/ancola-regular.ttf"));

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(700px 500px at 10% 0%, rgba(242,196,150,0.6), transparent), radial-gradient(700px 520px at 100% 100%, rgba(214,222,196,0.7), transparent), #faf8f4",
          color: "#1c1b19",
          fontFamily: "Ancola",
        }}
      >
        <div style={{ fontSize: 40, display: "flex" }}>
          parsewise<span style={{ color: "#7a4419" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "48px 52px",
            borderRadius: 32,
            background: "rgba(255,254,251,0.62)",
            border: "2px solid rgba(255,255,255,0.9)",
            boxShadow: "0 30px 60px -30px rgba(70,45,20,0.35)",
          }}
        >
          <div style={{ fontSize: 76, lineHeight: 1.05 }}>See your resume the way the ATS sees it.</div>
          <div style={{ fontSize: 30, marginTop: 24, color: "#5a574f" }}>
            Free resume parse check and job match. Nothing stored.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Ancola", data: ancola, style: "normal", weight: 400 }] },
  );
}
