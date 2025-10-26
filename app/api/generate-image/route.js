import { NextResponse } from "next/server";
import sharp from "sharp"; // npm install sharp

// Ensure this runs on the Node.js runtime (not Edge) since we use sharp and Buffer
export const runtime = "nodejs";
// Allow longer processing time for image generation on Vercel
export const maxDuration = 60;

export async function POST(req) {
  try {
    // Validate required env
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on server" },
        { status: 500 }
      );
    }
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

  /* -------- Hair synthesis logic (color-accurate) -------- */
  const COLOR_SPECS = {
    "Black": { desc: "true neutral black", hex: "#101010", negatives: "not brown, not brunette, avoid warm brown cast" },
    "Dark brown": { desc: "deep chocolate brown", hex: "#3B2C23", negatives: "not black, not blond" },
    "Medium brown": { desc: "neutral medium brown", hex: "#6A4F3D", negatives: "not blond, not black" },
    "Blonde": { desc: "light golden blonde", hex: "#E6D199", negatives: "not brunette, not brown, not dirty-blonde, not dark" },
    "Platinum": { desc: "cool platinum white‑blonde", hex: "#F3F3ED", negatives: "not yellow, not golden, not brown" },
    "Red/Auburn": { desc: "rich copper auburn", hex: "#A6452D", negatives: "not brown, not blond" },
    "Silver/Grey": { desc: "neutral silver grey", hex: "#C9CED3", negatives: "not yellow, not brown" },
    "Dyed green": { desc: "vivid emerald green", hex: "#0FA85B", negatives: "not brown, not blond" },
    "Dyed blue": { desc: "vivid cobalt blue", hex: "#1F5FE0", negatives: "not black, not brown" },
    "Dyed red": { desc: "vivid crimson red", hex: "#D21F3C", negatives: "not brown" },
    "Dyed pink": { desc: "vivid magenta pink", hex: "#E1469E", negatives: "not brown" },
    "Two-tone": { desc: "two‑tone style; keep first color dominant", hex: "#000000", negatives: "avoid unintended brown cast" },
  };

  const chosenColor = payload.hair?.colors || "Medium brown";
  const colorSpec = COLOR_SPECS[chosenColor] || COLOR_SPECS["Medium brown"];

  const streakBits = [];
  if (payload.hair?.streaks && payload.hair?.streaks !== "None") streakBits.push(payload.hair.streaks.toLowerCase());
  if (payload.hair?.streakDensity) streakBits.push(`${payload.hair.streakDensity.toLowerCase()} density`);
  if (payload.hair?.streakPlacement) streakBits.push(`placement at ${payload.hair.streakPlacement.toLowerCase()}`);

  const streakText = streakBits.length ? ` with ${streakBits.join(", ")}` : "";

  const hairDescription = `
Target hair color: ${chosenColor} (${colorSpec.desc}), approx hex ${colorSpec.hex}. Maintain hue in highlights, midtones, and shadows; do not shift toward other hues. ${colorSpec.negatives}.
Style: ${payload.hairStyles || "loose waves"} with ${payload.hairFinish || "natural texture"}${streakText}. Include realistic flyaways and ${payload.hairMotion || "subtle movement"}.
Hard requirement: hair must read clearly as ${chosenColor} to a viewer; avoid brown cast from exposure or white‑balance.
  `;

    /* -------- Realism & imperfection directives -------- */
    const realismEnhancements = `
### Real Optical Imperfections
1. Skin micro-texture: Randomize pore depth, micro capillary tint, and specular reflection. 
   Never use uniform smooth gradients or AI-like evenness.
2. Lighting & optical coherence: Imbalanced key/fill, add sensor noise, chromatic fringe, highlight bloom, and glass aberration.
3. Hairline & edge transitions: Avoid clean edges, include chaotic stray strands, irregular depth layering, real macro-lens behavior.
4. Background & depth plane: Lens-shaped bokeh; random focus drift between eyes, imperfect edge sharpness, micro tonal roll-off.
5. Tonal dynamics: Avoid optical calmness. Add random grain, uneven focus depth, and low-level film noise.
    `;

    const realismStandards = `
Generate a high-end fashion editorial photograph indistinguishable from real DSLR/medium-format photography.
Model must appear attractive, confident, and naturally human with visible texture, optical randomness, and depth coherence.
    `;

    let visualGuidance = "";
    if (poseRef && wardrobeRef)
      visualGuidance =
        "Use the body composition and posture from the Pose Reference image, and adopt wardrobe texture and silhouette cues from the Wardrobe Reference image.";
    else if (poseRef)
      visualGuidance =
        "Use the body posture and head orientation from the Pose Reference image.";
    else if (wardrobeRef)
      visualGuidance =
        "Incorporate wardrobe silhouette, color, and fabric cues from the Wardrobe Reference image.";

    /* -------- Aspect Ratio Mapping (map to provider-supported sizes) -------- */
    // OpenAI Images API supports: '1024x1024', '1024x1536', '1536x1024'.
    let size = "1024x1024";
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        size = "1024x1536"; // portrait
        break;
      case "9:16 (Vertical)":
        size = "1024x1536"; // use supported tall size
        break;
      case "16:9 (Landscape)":
        size = "1536x1024"; // wider landscape
        break;
      default:
        size = "1024x1024";
    }

    /* -------- Final Prompt -------- */
    const prompt = `
${realismStandards}
${realismEnhancements}

Model: ${payload.models || "female"} (${payload.ethnicities || "any"}, age ${payload.ageGroups || "25–30"}).
${hairDescription}

Makeup: ${payload.makeupFace || "natural"}, eyes: ${payload.makeupEyes || "defined"}, lips: ${payload.makeupLips || "soft"}.
Wardrobe: ${payload.wardrobeStyles || "minimalist 90s"}, ${payload.wardrobeTextures || "satin / silk sheen"}.
Lighting: ${payload.lightingMood || "studio"}, tone: ${payload.toneStyle || "cinematic"}.
Camera: ${payload.cameras || "Canon EOS R5"} with ${payload.lenses || "85mm f/1.2"} at ${payload.fStops || "f/2"}.

${visualGuidance}
The resulting image must maintain visible optical imperfections and realistic photographic texture.
    `;

    /* -------- Prepare API call -------- */
    const reqBody = {
      model: "gpt-image-1",
      prompt,
      size,
    };

    // NOTE: uploading binary reference images directly to the Images Generations
    // endpoint is not supported with a JSON body. For now we ignore attachments
    // (poseRef / wardrobeRef) and only use them for prompt guidance above.

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(reqBody),
    });

    // If OpenAI returns a non-2xx, surface the error details
    let data;
    try {
      data = await res.json();
    } catch (_) {
      // Non-JSON response
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Upstream error ${res.status}`, details: txt?.slice(0, 1000) },
        { status: 500 }
      );
    }

    if (!res.ok) {
      const message = data?.error?.message || "Image generation failed";
      return NextResponse.json(
        { error: message, details: process.env.DEBUG_IMAGE === "true" ? data : undefined },
        { status: 500 }
      );
    }
    const entry = data.data?.[0] || {};
    const imageUrl = entry.url;
    const b64 = entry.b64_json || entry.b64json || entry.b64;

    if (!imageUrl && !b64) {
      console.error("OpenAI response missing image:", data);
      const details = process.env.DEBUG_IMAGE === "true" ? data : undefined;
      return NextResponse.json({ error: "No image returned", details }, { status: 500 });
    }

    /* -------- Automatic realism noise layer -------- */
    let buffer;
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed fetching generated image URL: ${imgRes.status}`);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      // provider returned base64 directly
      buffer = Buffer.from(b64, "base64");
    }

    // Get image dimensions to generate a matching noise overlay
    const imgSharp = sharp(buffer);
    const meta = await imgSharp.metadata();
    const w = meta.width || 1024;
    const h = meta.height || 1024;

    // Create a simple random-grain noise buffer (grayscale) and composite it
    const noiseRaw = Buffer.alloc(w * h);
    for (let i = 0; i < noiseRaw.length; i++) {
      // small gaussian-like distributed noise via uniform random (good enough here)
      noiseRaw[i] = Math.floor(Math.random() * 32) + 112; // values around mid-gray
    }

    const noisePng = await sharp(noiseRaw, { raw: { width: w, height: h, channels: 1 } })
      .png()
      .toBuffer();

    const noiseBuffer = await imgSharp
      .jpeg({ quality: 96 })
      .modulate({ brightness: 1.02, saturation: 1.02 })
      .composite([
        {
          input: noisePng,
          blend: "overlay",
          opacity: 0.12,
        },
      ])
      .toBuffer();

    const realismURL = `data:image/jpeg;base64,${noiseBuffer.toString("base64")}`;

    return NextResponse.json({ imageUrl: realismURL });
  } catch (err) {
    console.error("Error generating image:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
