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
      "Black": { 
        desc: "true neutral black", hex: "#101010", 
        negatives: "not brown, not brunette, avoid warm brown cast",
        refs: ["Demi Moore", "Kim Kardashian black hair"]
      },
      "Dark brown": { 
        desc: "deep chocolate brown", hex: "#3B2C23", 
        negatives: "not black, not blond",
        refs: ["Natalie Portman", "Emma Watson brown hair"]
      },
      "Medium brown": { 
        desc: "neutral medium brown", hex: "#6A4F3D", 
        negatives: "not blond, not black",
        refs: ["Emma Watson", "Kate Middleton brown hair"]
      },
      "Blonde": { 
        desc: "Margot Robbie Barbie movie blonde", 
        hex: "#F1D877",
        lightHex: "#FBE9B7", 
        darkHex: "#E6C98F",
        negatives: `ABSOLUTELY NO BROWN ALLOWED - CRITICAL PRIORITY:
1. The hair must be PURE BLONDE like Margot Robbie in Barbie (2023)
2. Not a single brown tone anywhere in the hair
3. Not dirty blonde, dark blonde, or honey blonde
4. No brunette undertones whatsoever
5. Zero brown pigments - this is non-negotiable
6. The image must read as obviously and unmistakably blonde
7. Treat this as a mathematical requirement: if hair_color != blonde, reject_image()`,
        refs: ["Margot Robbie Barbie 2023 platinum blonde", "Taylor Swift folklore era blonde", "Pure golden blonde reference"],
        forceLight: true,
        requiresNeutralLighting: true,
        colorPriority: "absolute",
        lightingNotes: "Preserve dramatic lighting while ensuring hair reads as blonde",
        technicalNotes: "Dual exposure: bright for hair, dramatic for rest",
        visualRefs: ["Barbie 2023 movie stills", "High fashion blonde model portraits"],
        emphasizeColor: true
      },
      "Platinum": { 
        desc: "cool platinum white-blonde", hex: "#F3F3ED", 
        lightHex: "#FFFFFF", darkHex: "#E8E8E8",
        negatives: "not yellow, not golden, absolutely no brown",
        refs: ["platinum blonde reference", "Lady Gaga platinum hair"],
        forceLight: true
      },
      "Red/Auburn": { 
        desc: "rich copper auburn", hex: "#A6452D", 
        negatives: "not brown, not blond",
        refs: ["Emma Stone red hair", "Jessica Chastain"]
      },
      "Silver/Grey": { 
        desc: "neutral silver grey", hex: "#C9CED3", 
        negatives: "not yellow, not brown",
        refs: ["silver hair reference", "grey hair model"]
      },
      "Dyed green": { desc: "vivid emerald green", hex: "#0FA85B", negatives: "not brown, not blond" },
      "Dyed blue": { desc: "vivid cobalt blue", hex: "#1F5FE0", negatives: "not black, not brown" },
      "Dyed red": { desc: "vivid crimson red", hex: "#D21F3C", negatives: "not brown" },
      "Dyed pink": { desc: "vivid magenta pink", hex: "#E1469E", negatives: "not brown" },
      "Two-tone": { desc: "two‑tone style; keep first color dominant", hex: "#000000", negatives: "avoid unintended brown cast" },
    };  const chosenColor = payload.hair?.colors || "Medium brown";
  const colorSpec = COLOR_SPECS[chosenColor] || COLOR_SPECS["Medium brown"];

  const streakBits = [];
  if (payload.hair?.streaks && payload.hair?.streaks !== "None") streakBits.push(payload.hair.streaks.toLowerCase());
  if (payload.hair?.streakDensity) streakBits.push(`${payload.hair.streakDensity.toLowerCase()} density`);
  if (payload.hair?.streakPlacement) streakBits.push(`placement at ${payload.hair.streakPlacement.toLowerCase()}`);

  const streakText = streakBits.length ? ` with ${streakBits.join(", ")}` : "";

  // Extra enforcement for light colors that often drift to brunette
  const blondeEnforcement = chosenColor === "Blonde" || chosenColor === "Platinum"
    ? `
CRITICAL COLOR CONSTRAINTS (hair):
- Perceived luminance of hair should be high: sRGB Y ≈ 70–92 for >80% of visible strands.
- Avoid brunette/brown/espresso/chestnut hues entirely; zero tolerance for dark brown cast.
- Keep hue in blonde range: approximate Lab targets L* 75–93, a* −5..+8, b* +10..+30.
- Root shadow allowed but limited: neutral beige shadow only 5–10% coverage, not dark brown.
- Eyebrows slightly lighter than hair, not dark; eyelashes not heavy black.
    `
    : "";

  const hairDescription = `
Target hair color: ${chosenColor} (${colorSpec.desc}), approx hex ${colorSpec.hex}. Maintain hue in highlights, midtones, and shadows; do not shift toward other hues. ${colorSpec.negatives}.
${blondeEnforcement}
Style: ${payload.hairStyles || "loose waves"} with ${payload.hairFinish || "natural texture"}${streakText}. Include realistic flyaways and ${payload.hairMotion || "subtle movement"}.
Hard requirement: hair must read clearly as ${chosenColor} to a viewer in any lighting; do not let exposure or white‑balance introduce a brown cast.
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
    // Provider request size: keep at 1024x1024 for speed/reliability; we will post-process to requested aspect.
    const providerSize = "1024x1024";
    let targetW = 1024;
    let targetH = 1024;
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        targetW = 1024;
        targetH = 1536; // portrait output
        break;
      case "9:16 (Vertical)":
        targetW = 1024;
        targetH = 1820; // vertical output
        break;
      case "16:9 (Landscape)":
        targetW = 1536;
        targetH = 1024; // landscape output
        break;
      default:
        targetW = 1024;
        targetH = 1024;
    }

    /* -------- Final Prompt -------- */
    // Strict lighting control for blonde hair accuracy
    if (colorSpec.forceLight === true || colorSpec.requiresNeutralLighting === true) {
      const originalLighting = payload.lightingMood;
      const originalStyle = payload.editorialStyle;

      // Force blonde-optimized lighting while preserving artistic intent
      payload.lightingMood = `${originalLighting} with additional blonde-specific lighting:
- Main light: High-powered key light positioned to illuminate hair
- Hair light: Strong backlight to create blonde highlight rim
- Fill light: Soft fill to prevent shadows from darkening hair
- Overall: Maintain bright exposure on hair while keeping dramatic contrast elsewhere`;

      // Ensure color accuracy in editorial style
      payload.editorialStyle = `Blonde hair focus (${originalStyle}) - Reference: Margot Robbie Barbie (2023)`;
      
      // Force technical settings for blonde visibility
      payload.toneStyle = "High-key blonde-optimized processing";
      payload.lensFilters = "Hair highlight enhancing diffusion";
      
      // Special handling for dramatic lighting setups
      if (originalLighting?.includes("overhead") || 
          originalLighting?.includes("spot") || 
          originalLighting?.includes("rim") || 
          originalLighting?.includes("silhouette")) {
        payload.lightingMood += `
CRITICAL: Maintain blonde hair visibility:
- Add front fill light to prevent hair shadowing
- Ensure hair reads as clearly blonde
- Preserve dramatic lighting on face/body while keeping hair bright`;
      }
    }

    // Special color preface for blonde/platinum to force correct interpretation
    const colorPreface = colorSpec.forceLight
      ? `ABSOLUTE MANDATORY REQUIREMENT - CREATE A BLONDE MODEL:
This is a hard requirement to generate a BLONDE model. The final image MUST show definitively BLONDE HAIR, similar to these exact references:

PRECISE COLOR VALUES (MUST MATCH EXACTLY):
1. Main Hair Color: Bright golden blonde
   - Hex: #F1D877 (RGB 241,216,119)
   - Like Margot Robbie's Barbie movie hair
   
2. Highlight Color: Light warm blonde
   - Hex: #FBE9B7 (RGB 251,233,183)
   - Like Taylor Swift's signature blonde
   
3. Lowlight Color: Pale golden
   - Hex: #E6C98F (RGB 230,201,143)
   - NO DARKER THAN THIS VALUE

CRITICAL COLOR RULES:
- Hair must be UNMISTAKABLY BLONDE
- Exact match to Margot Robbie's Barbie blonde
- ZERO brown pigments or undertones
- No dark blonde, honey blonde, or dirty blonde
- Must read as clearly blonde even in dramatic lighting

2. CELEBRITY COLOR REFERENCE:
- Match the exact blonde tone of Margot Robbie in Barbie (2023)
- Or Taylor Swift's signature golden blonde
- Think California beach blonde, not brunette

3. MANDATORY REQUIREMENTS:
- Hair MUST read as definitively BLONDE in the final image
- ZERO brown/brunette tones permitted
- Every strand must be in the golden blonde spectrum
- Absolutely no dark or brown undertones
- This is a deal-breaker requirement - the hair must be BLONDE

IMPORTANT: This is not a suggestion - the model MUST have clearly blonde hair.
`
      : "";

    const prompt = `
${colorPreface}
${realismStandards}
${realismEnhancements}

Model: ${payload.models || "female"} (${payload.ethnicities || "any"}, age ${payload.ageGroups || "25–30"}).
${hairDescription}

ABSOLUTE COLOR CONTROL: Hair must match exact reference photos of ${colorSpec.refs?.join(", ")}

Makeup: ${payload.makeupFace || "natural"}, eyes: ${payload.makeupEyes || "defined"}, lips: ${payload.makeupLips || "soft"}.
Wardrobe: ${payload.wardrobeStyles || "minimalist 90s"}, ${payload.wardrobeTextures || "satin / silk sheen"}.
Lighting: ${colorSpec.forceLight ? "Bright studio key light with neutral fill" : (payload.lightingMood || "studio")}, tone: ${colorSpec.forceLight ? "Clean studio white balance" : (payload.toneStyle || "cinematic")}.
Camera: ${payload.cameras || "Canon EOS R5"} with ${payload.lenses || "85mm f/1.2"} at ${payload.fStops || "f/2"}.

${visualGuidance}
The resulting image must maintain visible optical imperfections and realistic photographic texture, while ensuring exact hair color accuracy.
    `;

    /* -------- Prepare API call -------- */
    const reqBody = {
      model: "gpt-image-1",
      prompt,
      size: providerSize,
      quality: "medium",
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
    if (b64) {
      // If provider ever returns base64 directly
      buffer = Buffer.from(b64, "base64");
    } else if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed fetching generated image URL: ${imgRes.status}`);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    }

    // Get image dimensions to generate a matching noise overlay
    // If target aspect differs, resize/crop to match requested ratio
    let workBuffer = buffer;
    if (targetW !== 1024 || targetH !== 1024) {
      workBuffer = await sharp(buffer)
        .resize({ width: targetW, height: targetH, fit: "cover", position: "attention" })
        .jpeg({ quality: 96 })
        .toBuffer();
    }

    const imgSharp = sharp(workBuffer);
    const meta = await imgSharp.metadata();
    const w = meta.width || targetW;
    const h = meta.height || targetH;

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
