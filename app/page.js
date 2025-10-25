"use client";

// This is the fully merged Ultimate Fashion Generator combining everything: all prior options plus all 90s magazine enhancements.
// Categories follow a logical creative flow...
import React, { useState, useEffect } from "react";
import { Upload } from "lucide-react";


const DATA = {
  // --- EDITORIAL STYLE REFERENCES ---
  editorialStyle: [
    "Helmut Newton (bold black & white glamour)",
    "Peter Lindbergh (natural daylight & emotion)",
    "Corinne Day (grunge realism)",
    "Steven Meisel (polished fantasy)",
    "Ellen von Unwerth (playful feminine energy)",
    "Juergen Teller (flash rawness)",
    "David Sims (experimental minimalism)",
    "Nick Knight (experimental color)",
    "Terry Richardson (raw high-flash portraits)",
    "Nan Goldin (intimate realism)",
    "Herb Ritts (sculptural light)",
    "Patrick Demarchelier (classic elegance)",
    "Mario Sorrenti (dreamlike sensual minimalism)",
    "Mario Testino (luxury candid)",
    "Annie Leibovitz (cinematic storytelling)",
    "Bruce Weber (youthful Americana energy)"
  ],

  // --- MODEL SETUP ---
  models: ["Female", "Male"],
  ethnicities: ["Caucasian","Black","East Asian","South Asian","Latina","Mixed","Middle Eastern","Indigenous"],
  ageGroups: ["18-22","22-25","25-30","30-35","35-40","40-45","45-50","50-55","55-60","60-65","65-70","70-75"],

  // --- APPEARANCE ---
  makeupFace: ["Natural skin-like","Matte velvet","Dewy glow","Soft glam","Editorial highlight","Bronzed contour","Bare minimal","90s powder matte","Porcelain","Fresh gloss"],
  makeupEyes: ["Bare","Clean mascara","Winged liner","Smoky","Glossy lid","Color accent","Thin 90s line","Metallic","Underliner","Soft fade","Dark rim"],
  makeupLips: ["Nude gloss","Satin nude","Soft pink","Red matte","Berry tint","Bare balm","Chocolate brown","Glossy red","Ombre fade","Muted mauve"],

  // --- HAIR ---
  hair: {
    colors: ["Black","Dark brown","Medium brown","Blonde","Platinum","Red/Auburn","Silver/Grey","Dyed green","Dyed blue","Dyed red","Dyed pink","Two-tone"],
    streaks: ["None","Blonde streaks","Red streaks","Green streaks","Blue streaks","Pink streaks","Purple streaks","Copper streaks","Platinum streaks"],
    streakDensity: ["Subtle","Medium","Heavy"],
    streakPlacement: ["Front pieces","Underlayer","Face-framing","Crown","Tips/ends","Random micro-streaks"]
  },
  hairStyles: ["Straight","Loose waves","Defined curls","Slicked back","Low bun","High bun","Bob","Wet look","Pixie cut","Messy bob","Curtain bangs","Half-up","Tousled layers","Long blowout","Pinned sides"],
  hairFinish: ["Wet & glossy","Dry and textured","Frizzed natural edge","Sleek ironed finish","Voluminous blowout","Sculptural gel shapes","Wispy flyaways (editorial realism)"],
  hairMotion: ["Static","Light move","Wind-blown","Motion blur","High wind"],

  // --- WARDROBE ---
  wardrobeStyles: ["Minimalist 90s","Avant-garde couture","Sports luxe","Grunge editorial","Classic power suit","Lingerie layering","Streetwear fusion","Soft romantic","Sheer textures","Structured tailoring","Leather & denim","Maximalist prints"],
  wardrobeTextures: ["Satin / silk sheen","Crinkled nylon","Leather & latex","Sheer mesh layers","Velvet richness","Denim & distressed cotton","Metallic lamé","Organza transparency","Lace overlay"],
  wardrobeAccessories: ["Sunglasses (oval / cat-eye / wraparound)","Gloves (leather / satin / mesh)","Statement jewelry (choker / hoops / chain)","Headwear (beret / cap / bandana)","Belts (logo buckle / chain link)","Sheer scarf or veil"],

  // --- ENVIRONMENT ---
  backdropLocation: ["Studio seamless (white, gray, pink, black)","Textured concrete wall","Fabric backdrop (crinkled muslin, velvet, metallic foil)","Vintage apartment interior","Rooftop daylight","Alley or fire escape","Desert landscape","City street flash","Neon storefronts"],
  backdropConcepts: ["Chromatic seamless (orange / teal / lilac)","Muslin crumple (texture depth)","Checker floor (Vogue Italia set style)","Velvet curtain drape","Tiled bathroom / kitchen realism","Plastic wrap / metallic foil","Collaged paper wall","High-gloss resin backdrop"],
  props: ["Magazine stacks / cigarette / coffee cup","Old CRT TV or VHS props","Studio stool / ladder / mirror","Plastic chair / lucite cube","Handbag as prop","Telephone cord wrap","Compact mirror reflection","Bare bulb light fixture","Industrial fan wind effect"],

  // --- LIGHTING & TONE ---
  lightingMood: ["Flash on camera (90s paparazzi)","Single strobe with spill","Soft daylight with haze","Mixed fluorescent and daylight","Tungsten warm tone","Color gel split (cyan/magenta)","Hard overhead spot (Vogue Italia style)","Silhouette rim light","Harsh spotlight contrast","Fluorescent wash","Cross-light twin source"],
  toneStyle: ["Hyper-saturated magazine color","Film grain nostalgia","Dreamlike blur / lens flare","Backstage energy","Cinematic still frame","Afterparty glow","Industrial romance","Luxury isolation"],

  // --- CAMERA ---
  cameras: ["Canon EOS R5","Nikon Z7 II","Sony A7R IV","Fujifilm GFX 100","Hasselblad X2D","Pentax 645Z (emul)","Contax 645 (90s)"],
  lenses: ["35mm f/1.4","50mm f/1.2","85mm f/1.2","100mm macro","70-200mm f/2.8","135mm f/2","24-70mm f/2.8"],
  fStops: ["f/1.2","f/1.4","f/2","f/2.8","f/4","f/5.6","f/8","f/11"],
  framings: ["Extreme close-up","Close-up","Medium","Wide","Super wide","Editorial crop","Half-body"],
  angles: ["Eye-level","¾","Low","Top-down","Side profile","Dutch tilt","Over-shoulder"],

  // --- LENS & POST ---
  lensFilters: ["Diffusion filter (soft glow)","Star filter (specular sparkle)","Vaseline edge blur (DIY style)","Tilt-shift fashion focus","Chromatic aberration edges"],
  cameraTreatment: ["Film grain intensity (none / subtle / heavy)","Motion blur level","Lens flare / specular highlight","Overexposed fashion flash","Cross-processed tones","Sepia or faded print tone"],
  filmDevelopment: ["Push-processed contrast","Pull-processed flat tone","Cross-processed cyan tint","Expired film effect","Print-scan blur","Light leak edge flare","Dust & scratch texture"],

  // --- EXPRESSION & EMOTION ---
  expressions: ["Neutral","Soft smile","Eyes-only smile","Warm friendly","Serious / editorial","Confident gaze","Calm focus","Playful","Intense gaze","Gentle laugh","Sultry","Pensive","Eyes closed","Laugh mid-shot","Side glance","Bold stare","Smirk","Dramatic"],
  modelEmotion: ["Detached and cool","Rebellious street energy","Subtle confidence","Melancholic / introspective","Avant-garde expression","Joyful chaos"],
  poses: ["Candid motion shot","Model leaning forward","Head tilt with tensioned neck","Seated introspection","Arm-in-frame gesture","Over-the-shoulder look","Reclined attitude","Jump shot motion","Mirror interaction"],

  // --- COLOR & TYPOGRAPHY ---
  colorPalettes: ["Cool chrome & mauve","Warm beige & terracotta","Desaturated neutrals","Jewel tones (emerald, sapphire, ruby)","Washed pastel 90s tones","Filmic cyan-magenta contrast"],

  // --- MOOD & CONCEPTS ---
  moodboardKeywords: ["Backstage Chaos","Hotel Room Intimacy","Street Flash Realism","Luxury Isolation","Industrial Romance","Afterparty Glow","Cinematic Still","Faux Candid","Untouched Beauty"]
};

export default function UltimateFashionGeneratorExpanded() {
  const [selected, setSelected] = useState({});
  const [poseRef, setPoseRef] = useState(null);
  const [wardrobeRef, setWardrobeRef] = useState(null);
  const [posePreview, setPosePreview] = useState(null);
  const [wardrobePreview, setWardrobePreview] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedError, setGeneratedError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bgColor, setBgColor] = useState("#ffffff");

  const realismEnhancements = {
    facialRealism: true,
    skinConsistency: true,
    naturalImperfections: true,
    microDetailAlignment: true,
    sensorNoise: "organic DSLR",
    compressionRealism: "JPEG-style",
    ELAConsistency: true,
    cameraMetadata: true,
    lightingEdgeCoherence: true,
    grainUniformity: "fine even grain"
  };

  const handleSelect = (category, value) => setSelected((p) => ({ ...p, [category]: value }));
  const onUpload = (f, setF, setPrev) => {
    if (!f) return;
    setF(f);
    setPrev(URL.createObjectURL(f));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedError(null);
    const formData = new FormData();
    formData.append("payload", JSON.stringify({ ...selected, bgColor, realismEnhancements }));
    if (poseRef) formData.append("poseRef", poseRef);
    if (wardrobeRef) formData.append("wardrobeRef", wardrobeRef);
    try {
      const res = await fetch("/api/generate-image", { method: "POST", body: formData });
      const out = await res.json();

      if (!res.ok) {
        console.error("Generate API error:", out);
        setGeneratedError(out.error || "Generation failed");
        setGeneratedImage(null);
        return;
      }

      // Support either a remote URL or a data URL (base64)
      const img = out.imageUrl || out.imageBase64 || out.image;
      if (!img) {
        setGeneratedError("No image returned from generation API");
        setGeneratedImage(null);
      } else {
        setGeneratedImage(img);
        setGeneratedError(null);
      }
    } catch (err) {
      console.error(err);
      setGeneratedError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // --- Progress Bar Element (smooth animated version) ---
  const ProgressBar = ({ loading }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      let interval;
      if (loading) {
        setProgress(0);
        interval = setInterval(() => {
          setProgress((prev) => {
            // Gradually increase progress to simulate work
            if (prev < 90) return prev + Math.random() * 10; // stop near 90% until done
            return prev;
          });
        }, 300);
      } else {
        // Complete and fade out
        setProgress(100);
        const timeout = setTimeout(() => setProgress(0), 700);
        return () => clearTimeout(timeout);
      }
      return () => clearInterval(interval);
    }, [loading]);

    return (
      <div
        className={`fixed top-0 left-0 h-[3px] bg-indigo-600 transition-all duration-300 ease-out ${
          progress > 0 ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: `${progress}%`, zIndex: 50 }}
      ></div>
    );
  };


  const renderCategory = (label, values, key) => (
    <div key={key} className="mb-6">
      <h2 className="text-lg font-medium mb-2 capitalize">{label}</h2>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => handleSelect(key, v)}
            className={`px-4 py-2 rounded-full border text-sm transition ${selected[key] === v ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white/70 dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-50 p-6">
      <ProgressBar loading={loading} />
      <h1 className="text-2xl font-semibold mb-4">Model Gen</h1>
      {Object.entries(DATA).map(([k, v]) =>
        typeof v === "object" && !Array.isArray(v) ? (
          <div key={k} className="mb-8">
            <h2 className="text-xl font-semibold mb-3 capitalize">{k}</h2>
            {Object.entries(v).map(([sub, vals]) => renderCategory(sub, vals, sub))}
          </div>
        ) : (
          renderCategory(k, v, k)
        )
      )}

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Background Color</h2>
        <div className="flex items-center gap-4">
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-16 h-10 cursor-pointer border border-zinc-300 rounded-lg" />
          <div className="w-[200px] h-[200px] border border-zinc-300 rounded-lg" style={{ backgroundColor: bgColor }}></div>
        </div>
      </div>

      {/* Pose and Wardrobe Reference Uploads side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {[{ label: "Pose Reference (optional)", file: poseRef, set: setPoseRef, prev: posePreview, setPrev: setPosePreview }, { label: "Wardrobe Reference (optional)", file: wardrobeRef, set: setWardrobeRef, prev: wardrobePreview, setPrev: setWardrobePreview }].map(({ label, set, setPrev, prev }) => (
          <div key={label} className="mb-6">
            <h2 className="text-lg font-medium mb-2">{label}</h2>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white cursor-pointer">
              <Upload size={18} /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0] || null, set, setPrev)} />
            </label>
            {prev && (
              <div className="mt-4 border border-zinc-300 rounded-xl overflow-hidden w-full h-[300px]">
                <img src={prev} alt={`${label} preview`} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Aspect Ratio</h2>
        <div className="flex flex-wrap gap-2">
          {["1:1 (Square)", "3:4 (Portrait)", "9:16 (Vertical)", "16:9 (Landscape)"].map((ratio) => (
            <button
              key={ratio}
              onClick={() => setSelected((p) => ({ ...p, aspectRatio: ratio }))}
              className={`px-4 py-2 rounded-full border text-sm transition ${
                selected.aspectRatio === ratio
                  ? "bg-indigo-600 text-white border-indigo-600 shadow"
                  : "bg-white/70 dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>


      <button onClick={handleGenerate} disabled={loading} className={`w-full px-5 py-3 rounded-xl font-semibold mt-4 ${loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
        {loading ? "Generating..." : "Generate Image"}
      </button>

      {generatedError && (
        <div className="mt-4 p-4 rounded-lg bg-red-50 text-red-700 border border-red-100">
          <strong>Error:</strong> {generatedError}
        </div>
      )}

      {generatedImage && (
        <div className="mt-6 text-center">
          <h3 className="text-lg font-medium mb-2">Generated Result</h3>
          <img src={generatedImage} alt="generated" className="mx-auto max-h-[480px] rounded-2xl shadow-lg border" style={{ backgroundColor: bgColor }} />
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2">Payload Preview</h3>
        <pre className="text-xs whitespace-pre-wrap bg-zinc-900 text-zinc-50 p-4 rounded-xl overflow-auto max-h-[70vh]">{JSON.stringify({ ...selected, bgColor, realismEnhancements }, null, 2)}</pre>
      </div>
    </div>
  );
}
