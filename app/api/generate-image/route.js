import { NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

    /* ---------------- realism bias section ---------------- */
    const antiAICues = `
You are rendering a **real photograph**, not an illustration or digital artwork.

Enforce **optical imperfection realism** to avoid AI-like smoothness or geometric perfection.
1. **Micro-texture variance** – introduce irregular pore size, subtle skin oil reflectance, and slightly uneven shadow diffusion. Avoid any uniform skin noise.
2. **Sensor bloom & falloff** – emulate low-ISO DSLR micro-noise and gentle sensor roll-off in highlight areas; include slight chroma noise in shadows.
3. **Facial transition realism** – add micro-tonal variance and mild boundary roughness at hairline, nose bridge, lips, and jaw edges. Avoid mathematically smooth gradients.
4. **Fabric & transparency realism** – include slight moiré or interference where thin fabrics overlap lighting; avoid perfect transparency cut-outs.
5. **Optical coherence** – introduce mild field curvature, minute focus drift, and natural asymmetry between eyes and facial planes.
6. **Depth randomness** – replicate lens breathing and focus falloff across z-axis; do not equalize focus plane.
7. **Post-process imperfection** – simulate light compression, low-level JPEG artifacts, and faint dust or micro-scratch texture.
    `;

    const realismStandards = `
Models appear attractive, confident, and photorealistic—styled for high-end editorial campaigns.
Maintain visible pores, real texture, authentic lighting, and natural asymmetry consistent with DSLR or medium-format photography.
    `;

    let visualGuidance = "";
    if (poseRef && wardrobeRef)
      visualGuidance =
        "Use the pose composition from the Pose Reference and wardrobe cues from the Wardrobe Reference image.";
    else if (poseRef)
      visualGuidance = "Follow the body composition from the Pose Reference image.";
    else if (wardrobeRef)
      visualGuidance = "Adopt clothing silhouette and texture from the Wardrobe Reference image.";

    // Map requested aspect ratios to OpenAI Images API supported sizes:
    // supported: '1024x1024', '1024x1536', '1536x1024', and 'auto'
    // We'll pick the closest supported generation size, then post-process
    // to an exact pixel dimension (crop/resize) using sharp below.
    let size = "1024x1024";
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        size = "1024x1536"; // portrait supported size
        break;
      case "9:16 (Vertical)":
        size = "auto"; // no exact 9:16 supported — use auto then crop
        break;
      case "16:9 (Landscape)":
        size = "1536x1024"; // landscape supported size
        break;
      default:
        size = "1024x1024";
    }

    /* ---------------- final prompt assembly ---------------- */
    const prompt = `
${realismStandards}
${antiAICues}

Generate a **true photographic capture** of a ${payload.models || "female"} model for a 90s fashion editorial.
${visualGuidance}

Ethnicity: ${payload.ethnicities || "any"}, Age: ${payload.ageGroups || "25–30"}.
Makeup: ${payload.makeupFace || "natural"} face, ${payload.makeupEyes || "defined eyes"}, ${payload.makeupLips || "soft lips"}.
Hair: ${payload.hairStyles || "loose waves"} in ${payload.hair?.colors || "medium brown"}.
Wardrobe: ${payload.wardrobeStyles || "minimalist 90s"} using ${payload.wardrobeTextures || "fabric texture"}.
Lighting: ${payload.lightingMood || "studio"} with ${payload.toneStyle || "cinematic tone"}.
Camera: ${payload.cameras || "Canon EOS R5"} and ${payload.lenses || "85mm f/1.2"} at ${payload.fStops || "f/2"}.
Add natural lens imperfections, asymmetry, realistic sensor grain, and physical optical flaws.
    `;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
      }),
    });

    const data = await res.json();

    // surface provider errors
    if (!res.ok) {
      const message = data?.error?.message || JSON.stringify(data);
      console.error("OpenAI images API error:", message);
      return NextResponse.json({ error: message }, { status: res.status || 502 });
    }

    // Support both remote URL and base64 payloads
    const entry = data.data?.[0] || {};
    const imageUrl = entry.url;
    const b64 = entry.b64_json || entry.b64json || entry.b64;

    // Determine exact output pixel dims for each aspect ratio (server-side crop)
    const aspect = payload.aspectRatio || "1:1 (Square)";
    const targetMap = {
      "1:1 (Square)": { width: 1024, height: 1024 },
      "3:4 (Portrait)": { width: 1024, height: 1365 },
      // exact tall fallback for 9:16
      "9:16 (Vertical)": { width: 1024, height: 1820 },
      "16:9 (Landscape)": { width: 1536, height: 864 },
    };
    const target = targetMap[aspect] || { width: 1024, height: 1024 };

    // helper to fetch a remote image to a buffer
    const fetchToBuffer = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed fetching image: ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    };

    let inputBuffer;
    if (imageUrl) {
      try {
        inputBuffer = await fetchToBuffer(imageUrl);
      } catch (err) {
        console.error("Failed to fetch generated image URL:", err);
        return NextResponse.json({ error: "Failed to fetch generated image" }, { status: 502 });
      }
    } else if (b64) {
      inputBuffer = Buffer.from(b64, "base64");
    } else {
      console.error("Unexpected OpenAI response shape:", data);
      return NextResponse.json({ error: "Image generation failed", details: data }, { status: 502 });
    }

    try {
      // Post-process to exact aspect ratio & dimensions
      const outBuffer = await sharp(inputBuffer)
        .resize(target.width, target.height, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();

      const outB64 = outBuffer.toString("base64");
      const imageBase64 = `data:image/png;base64,${outB64}`;
      return NextResponse.json({ imageBase64 });
    } catch (err) {
      console.error("Image post-processing failed:", err);
      // fallback: return original url when available
      if (imageUrl) return NextResponse.json({ imageUrl });
      return NextResponse.json({ error: "Image processing failed" }, { status: 500 });
    }
  } catch (err) {
    console.error("Image generation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
