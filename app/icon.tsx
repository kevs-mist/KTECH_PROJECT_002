import { ImageResponse } from "next/og";

// Route segment config — this file is rendered to a favicon at build time.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #0a84ff 0%, #0058d4 100%)",
                    color: "white",
                    fontSize: 20,
                    fontWeight: 700,
                    borderRadius: 6,
                    letterSpacing: "-0.04em",
                }}
            >
                PS
            </div>
        ),
        { ...size }
    );
}