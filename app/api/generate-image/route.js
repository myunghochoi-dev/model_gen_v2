import { NextResponse } from "next/server";
import sharp from "sharp"; // make sure to install: npm install sharp

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

    /* ---------------- realism imperfection directives ---------------- */
    const realismEnhancements = `
You are producing a genuine photographic image.

### Imperfection Directives
1. **Skin Micro-Texture**
   - Randomize pore depth, micro-highlight intensity, and tiny capillary color shifts across curvature.
   - Do **not** use uniform micro-noise or diffusion-style even lighting.
2. **Lighting & Optical Coherence**
   - Ensure key/fill are imbalanced. Add subtle chromatic fringe, micro-bloom, and sensor noise.
   - Include glass aberration and faint light bleed around bright edges.
3. **Hairline & Edge Transitions**
   - Avoid clean blending at the scalp. Add chaotic stray strands and non-uniform edge opacity.
   - Simulate macro-lens depth layering—random strand sharpness.
4. **Background & Depth Plane**
   - Simulate real bokeh curvature; never uniform blur.
   - Make sure each eye’s sharpness varies slightly.
   - Randomize tonal roll-off, introduce micro-focus drift, and avoid optical calmness.
5. **Film & Sensor Character**
   - Add natural grain, low-level dust, and faint compression.
   - Keep slight color drift near image corners (lens vignetting and sensor variation).
    `;

    /* ---------------- realism baseline ---------------- */
    const realismStandards = `
Generate a fashion editorial photograph indistinguishable from DSLR/medium-format imagery.
Maintain authentic human detail, natural lighting, emotional gaze, and organic imperfection.
    `;

    let visualGuidance = "";
    if (poseRef && wardrobeRef)
      visualGuidance =
        "Use the pose composition from the Pose Reference and wardrobe cues from the Wardrobe Reference image.";
    else if (poseRef)
      visualGuidance = "Use body composition cues from the Pose Reference image.";
    else if (wardrobeRef)
      visualGuidance = "Adopt silhouette, texture, and tone from the Wardrobe Reference image.";

    /* ---------------- aspect ratio → size mapping ---------------- */
    // OpenAI Images API accepts: '1024x1024', '1024x1536', '1536x1024', and 'auto'.
    // Choose the closest supported generation size, then we'll post-process
    // to exact pixel dimensions below.
    let size = "1024x1024";
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        size = "1024x1536";
        break;
      case "9:16 (Vertical)":
        size = "auto";
        break;
      case "16:9 (Landscape)":
        size = "1536x1024";
        break;
      default:
        size = "1024x1024";
    }

    /* ---------------- final prompt ---------------- */
    const prompt = `
${realismStandards}
${realismEnhancements}

Model: ${payload.models || "female"} (${payload.ethnicities || "any"}, age ${payload.ageGroups || "25–30"}).
Makeup: ${payload.makeupFace || "natural"} face, ${payload.makeupEyes || "defined eyes"}, ${payload.makeupLips || "soft lips"}.
Hair: ${payload.hairStyles || "loose waves"} in ${payload.hair?.colors || "medium brown"}.
Wardrobe: ${payload.wardrobeStyles || "minimalist 90s"} with ${payload.wardrobeTextures || "satin texture"}.
Lighting: ${payload.lightingMood || "studio"} — ${payload.toneStyle || "cinematic tone"}.
Camera: ${payload.cameras || "Canon EOS R5"} with ${payload.lenses || "85mm f/1.2"} at ${payload.fStops || "f/2"}.
${visualGuidance}
    `;

    /* ---------------- generate image via OpenAI ---------------- */
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

    // Surface provider errors
    if (!res.ok) {
      const message = data?.error?.message || JSON.stringify(data);
      console.error("OpenAI images API error:", message);
      return NextResponse.json({ error: message }, { status: res.status || 502 });
    }

    const entry = data.data?.[0] || {};
    const imageUrl = entry.url;
    const b64 = entry.b64_json || entry.b64json || entry.b64;

    // target pixel sizes for exact aspect ratio outputs (post-process)
    const aspect = payload.aspectRatio || "1:1 (Square)";
    const targetMap = {
      "1:1 (Square)": { width: 1024, height: 1024 },
      "3:4 (Portrait)": { width: 1024, height: 1365 },
      "9:16 (Vertical)": { width: 1024, height: 1820 },
      "16:9 (Landscape)": { width: 1536, height: 864 },
    };
    const target = targetMap[aspect] || { width: 1024, height: 1024 };

    // helper to fetch a remote image into a buffer
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
      console.error("OpenAI response missing image:", data);
      return NextResponse.json({ error: "No image returned", details: data }, { status: 500 });
    }

    try {
      // Resize/crop to exact target dimensions, then add subtle realism overlay
      const base = sharp(inputBuffer).resize(target.width, target.height, { fit: "cover", position: "centre" }).png();

      // Create a lightweight noise overlay and composite it
      const noise = {
        create: {
          width: target.width,
          height: target.height,
          channels: 1,
          background: { r: 128, g: 128, b: 128 },
        },
      };

      const processed = await base
        .composite([
          {
            input: noise,
            blend: "overlay",
            opacity: 0.08,
          },
        ])
        .png()
        .toBuffer();

      const outBase64 = processed.toString("base64");
      const imageBase64 = `data:image/png;base64,${outBase64}`;
      return NextResponse.json({ imageBase64 });
    } catch (err) {
      console.error("Image post-processing failed:", err);
      if (imageUrl) return NextResponse.json({ imageUrl });
      return NextResponse.json({ error: "Image processing failed" }, { status: 500 });
    }
  } catch (err) {
    console.error("Image generation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
