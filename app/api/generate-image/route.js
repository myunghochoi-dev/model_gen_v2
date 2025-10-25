import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = JSON.parse(formData.get("payload") || "{}");

    const prompt = `
      Create a fashion editorial photo with these details:
      ${JSON.stringify(payload, null, 2)}
      Make it realistic with DSLR texture and lighting.
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
    console.log("OpenAI API response:", data);

    if (!response.ok) {
      // surface provider error
      console.error("OpenAI images API error:", data);
      const message = data.error?.message || JSON.stringify(data);
      return NextResponse.json({ error: message }, { status: response.status || 500 });
    }

    // The provider might return either a remote URL or base64 content
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

    return NextResponse.json({ error: "No image returned", details: data }, { status: 502 });
  } catch (err) {
    console.error("Error in /api/generate-image:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
