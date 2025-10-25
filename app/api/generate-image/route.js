import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

    // Realism standards
    const realismStandards = `
You are a professional AI image-generation assistant that produces photorealistic fashion and skincare portraits indistinguishable from genuine DSLR or medium-format photography.
Models must appear attractive, confident, and professional—styled as if for high-end beauty, editorial, or advertising campaigns—while preserving genuine human imperfections and natural optical artifacts.

### Core Rendering Standards
1. Authenticity — Maintain visible pores, micro blemishes, natural tone variation, and light scatter through skin.
2. Natural Beauty — Balanced symmetry, confident posture, expressive eyes, natural charisma.
3. Skin Texture — Preserve lifelike pores and stray hairs; never over-smooth.
4. Lighting Realism — Studio realism with mild imperfections (reflections, uneven shadows).
5. Eye Realism — Focused, expressive eyes with natural emotion.
6. Hair — Include realistic edge softness and fine flyaways.
7. Wardrobe — Real folds and draping, not painted textures.
8. Camera — Depth of field, sensor noise, bokeh, and mild compression artifacts.
9. Overall Aesthetic — Healthy, luminous beauty consistent with professional editorial photography.
    `;

    // Describe how to use reference images
    let visualGuidance = "";
    if (poseRef && wardrobeRef) {
      visualGuidance =
        "Use the pose and composition from the Pose Reference image and the wardrobe, fabric texture, and silhouette style from the Wardrobe Reference image.";
    } else if (poseRef) {
      visualGuidance =
        "Use the pose and body composition cues from the Pose Reference image as guidance.";
    } else if (wardrobeRef) {
      visualGuidance =
        "Use the clothing silhouette, texture, and tone from the Wardrobe Reference image.";
    }

    // --- Handle Aspect Ratio selection ---
    // OpenAI Images API accepts only a limited set of sizes:
    // '1024x1024', '1024x1536', '1536x1024', and 'auto'.
    // Map requested aspect ratios to the closest supported value.
    let size = "1024x1024";
    switch (payload.aspectRatio) {
      case "3:4 (Portrait)":
        // Use the portrait size supported by the API
        size = "1024x1536";
        break;
      case "9:16 (Vertical)":
        // 9:16 is not directly supported; use 'auto' to let the provider
        // choose an appropriate tall output, or you can use 1024x1536 as a fallback.
        size = "auto";
        break;
      case "16:9 (Landscape)":
        // Use the landscape size supported by the API
        size = "1536x1024";
        break;
      default:
        size = "1024x1024";
    }

    // --- Final Prompt ---
    const prompt = `
${realismStandards}

Generate an ultra-realistic 90s fashion editorial photograph.
${visualGuidance}
Model: ${payload.models || "female model"} (${payload.ethnicities || "any"} ethnicity, age ${payload.ageGroups || "25-30"}).
Makeup: ${payload.makeupFace || "natural"} with ${payload.makeupEyes || "defined eyes"} and ${payload.makeupLips || "neutral lips"}.
Hair: ${payload.hairStyles || "loose waves"} in ${payload.hair?.colors || "medium brown"}.
Wardrobe: ${payload.wardrobeStyles || "minimalist 90s"}, ${payload.wardrobeTextures || "satin texture"}.
Lighting: ${payload.lightingMood || "studio"} — ${payload.toneStyle || "cinematic tone"}.
Camera: ${payload.cameras || "Canon EOS R5"} with ${payload.lenses || "85mm f/1.2"} at ${payload.fStops || "f/2"}.

Preserve micro pores, soft edges, stray hairs, expressive eyes, and genuine optical depth.
Reflect wardrobe cues without duplicating the source images.
    `;

    // --- Call OpenAI ---
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
      }),
    });

    const data = await res.json();
    console.log("OpenAI API response:", data);

    // Surface provider errors
    if (!res.ok) {
      const message = data?.error?.message || JSON.stringify(data);
      console.error("OpenAI images API error:", message);
      return NextResponse.json({ error: message }, { status: res.status || 502 });
    }

    // Support both remote URL and base64 payloads
    const entry = data.data?.[0] || {};
    const imageUrl = entry.url;
    const b64 = entry.b64_json || entry.b64json || entry.b64;

    if (imageUrl) {
      return NextResponse.json({ imageUrl });
    }

    if (b64) {
      const imageBase64 = `data:image/png;base64,${b64}`;
      return NextResponse.json({ imageBase64 });
    }

    // Unexpected response shape
    console.error("Unexpected OpenAI response shape:", data);
    return NextResponse.json({ error: "Image generation failed", details: data }, { status: 502 });
  } catch (err) {
    console.error("Error generating image:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
