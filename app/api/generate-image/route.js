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
    let size = "1024x1024";
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        size = "1024x1365";
        break;
      case "9:16 (Vertical)":
        size = "1024x1820";
        break;
      case "16:9 (Landscape)":
        size = "1365x768";
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
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      console.error("OpenAI API error:", data);
      return NextResponse.json({ error: "No image returned", details: data }, { status: 500 });
    }

    /* ---------------- add automatic realism noise layer ---------------- */
    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // add light grain overlay & micro tonal randomness
    const noiseBuffer = await sharp(buffer)
      .jpeg({ quality: 96 })
      .modulate({ brightness: 1.02, saturation: 1.01 })
      .composite([
        {
          input: {
            create: {
              width: 1024,
              height: 1024,
              channels: 1,
              noise: { type: "gaussian", mean: 128, sigma: 6 },
            },
          },
          blend: "overlay",
          opacity: 0.15,
        },
      ])
      .toBuffer();

    const noiseBase64 = noiseBuffer.toString("base64");
    const realismURL = `data:image/jpeg;base64,${noiseBase64}`;

    return NextResponse.json({ imageUrl: realismURL });
  } catch (err) {
    console.error("Image generation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
