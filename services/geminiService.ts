import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Note: We use process.env.API_KEY as per instructions.
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found in environment");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates a seamless texture pattern based on a prompt using Gemini.
 * Uses gemini-2.5-flash-image for generation.
 */
export const generateTexture = async (prompt: string): Promise<string | null> => {
  const ai = getClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Create a seamless texture or packaging design pattern. Style: ${prompt}. High quality, flat view, suitable for UV mapping on a box or bottle.`,
          },
        ],
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1", // Square textures are best for mapping
        }
      }
    });

    // Iterate parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Failed to generate texture:", error);
    throw error;
  }
};

/**
 * Generates a technical feasibility report summary using Gemini (simulated strictly for this demo, 
 * normally we would just hardcode this, but let's show off the text gen capability too).
 */
export const generateFeasibilityAnalysis = async (): Promise<string> => {
    const ai = getClient();
    if (!ai) return "API Key missing.";

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Briefly analyze the feasibility of building a web-based 3D packaging design tool (like Teemdrop) using React and Three.js. Provide 3 bullet points in Chinese focused on Performance, Technical Difficulty, and Market Readiness.",
        });
        return response.text || "无法生成报告";
    } catch (e) {
        return "报告生成失败";
    }
}
