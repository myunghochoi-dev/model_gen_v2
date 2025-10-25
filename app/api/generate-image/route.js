import { NextResponse } from "next/server";
import sharp from "sharp"; // npm install sharp

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

    /* -------- Hair synthesis logic -------- */
    const hairDescription = `
Hair should appear as ${payload.hair?.colors || "medium brown"} 
${payload.hair?.streaks && payload.hair?.streaks !== "None" ? "with " + payload.hair?.streaks.toLowerCase() : ""},
styled in a ${payload.hairStyles || "loose waves"} look with ${payload.hairFinish || "natural texture"}.
Include realistic flyaways and ${payload.hairMotion || "subtle movement"}.
The hair color and streaks must match the exact tone description; do not reinterpret hue.
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
    // OpenAI Images API supports: '1024x1024', '1024x1536', '1536x1024', and 'auto'.
    let size = "1024x1024";
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        size = "1024x1536"; // portrait
        break;
      case "9:16 (Vertical)":
        size = "auto"; // let provider choose a tall image, we will crop/resize server-side
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
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(reqBody),
    });

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      console.error("OpenAI response:", data);
      return NextResponse.json({ error: "No image returned", details: data }, { status: 500 });
    }

    /* -------- Automatic realism noise layer -------- */
    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
