import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

    // --- Describe how the model should use uploaded references ---
    let visualGuidance = "";
    if (poseRef && wardrobeRef) {
      visualGuidance =
        "Use the pose and body position from the uploaded Pose Reference image and replicate the overall outfit, texture, and silhouette style from the Wardrobe Reference image.";
    } else if (poseRef) {
      visualGuidance =
        "Use the pose, body posture, and composition cues from the uploaded Pose Reference image as the basis for the model's stance.";
    } else if (wardrobeRef) {
      visualGuidance =
        "Incorporate the outfit, fabric style, and color tone from the uploaded Wardrobe Reference image.";
    }

    // --- Build the core image generation prompt ---
    const prompt = `
      Create a hyper-realistic fashion editorial photograph.
      ${visualGuidance}
      Model: ${payload.models || "female model"}.
      Ethnicity: ${payload.ethnicities || "any"}.
      Age group: ${payload.ageGroups || "25-30"}.
      Makeup: ${payload.makeupFace || "natural skin-like"} with ${payload.makeupEyes || "defined eyes"} and ${payload.makeupLips || "neutral lips"}.
      Hair: ${payload.hairStyles || "loose waves"} (${payload.hair.colors || "medium brown"}), ${payload.hairFinish || "natural texture"}.
      Wardrobe: ${payload.wardrobeStyles || "minimalist 90s"}, ${payload.wardrobeTextures || "satin"}.
      Lighting: ${payload.lightingMood || "studio softbox"}, tone: ${payload.toneStyle || "cinematic"}.
      Camera: ${payload.cameras || "Canon EOS R5"} with ${payload.lenses || "85mm f/1.2"} at ${payload.fStops || "f/2"}.
      Ensure natural facial realism, consistent pores and freckles, DSLR sensor grain, and studio lighting accuracy.
    `;

    // --- Build the OpenAI API request ---
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      }),
    });

    const data = await response.json();
    console.log("OpenAI response:", data);

    if (!response.ok) {
      // surface provider error details
      const message = data?.error?.message || JSON.stringify(data);
      console.error("OpenAI images API error:", message);
      return NextResponse.json({ error: message }, { status: response.status || 502 });
    }

    // Provider may return either a remote URL or base64 content in various keys
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
    return NextResponse.json({ error: "Unexpected image response", details: data }, { status: 502 });
  } catch (err) {
    console.error("Error generating image:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
