import { NextResponse } from "next/server";

// This route receives the FormData payload from your generator UI
export async function POST(req) {
  try {
    // Parse the incoming form data
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");

    // (Optional) Log it for debugging — you'll see this in Vercel's logs
    console.log("Image generation payload:", payload);

    // --------------------------------------------
    // 1️⃣ Get any uploaded images (poseRef / wardrobeRef)
    // --------------------------------------------
    const poseRef = formData.get("poseRef");
    const wardrobeRef = formData.get("wardrobeRef");

    // --------------------------------------------
    // 2️⃣ Here’s where the actual image generation happens
    // --------------------------------------------
    // Example: using OpenAI’s Images API (DALL·E 3)
    // ⚠️ You’ll need to add your OpenAI API key in Vercel settings (see Step 3 below)

    const prompt = `
      Create a highly realistic fashion editorial photograph based on the following details:
      ${JSON.stringify(payload, null, 2)}
      Include natural skin texture, realistic lighting, lens accuracy, and studio background.
    `;

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
    const imageUrl = data.data?.[0]?.url;

    // --------------------------------------------
    // 3️⃣ Return the generated image URL
    // --------------------------------------------
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Error generating image:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
