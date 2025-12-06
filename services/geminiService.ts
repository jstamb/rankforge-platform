import { GoogleGenAI, Type } from "@google/genai";
import { SeoConfig } from "../types";

// Note: In a real app, this key comes from process.env.API_KEY.
// The component using this service should handle the missing key error gracefully if not set.
const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

export const generateSeoStrategy = async (
  businessName: string,
  businessType: string,
  location: string,
  services: string[]
): Promise<SeoConfig> => {
  if (!apiKey) {
    console.warn("API Key is missing. Returning mock data.");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title_tag: `Top Rated ${businessType} in ${location} | ${businessName}`,
          meta_description: `Looking for a professional ${businessType} in ${location}? ${businessName} offers expert ${services[0]} and ${services[1] || 'more'}. Call today for a quote!`,
          h1_heading: `Expert ${businessType} Services in ${location}`,
          keywords: [`${businessType} ${location}`, `best ${services[0]}`, `${businessName} reviews`]
        });
      }, 1500);
    });
  }

  try {
    const prompt = `
      Generate an SEO strategy for a local business.
      Business Name: ${businessName}
      Type: ${businessType}
      Location: ${location}
      Services: ${services.join(', ')}

      Return JSON with:
      - title_tag (max 60 chars)
      - meta_description (max 160 chars)
      - h1_heading
      - keywords (array of 5 strings)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title_tag: { type: Type.STRING },
            meta_description: { type: Type.STRING },
            h1_heading: { type: Type.STRING },
            keywords: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as SeoConfig;

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback in case of error
    return {
      title_tag: `${businessName} - ${businessType} in ${location}`,
      meta_description: `Professional ${businessType} services in ${location}. Contact ${businessName} for reliable service.`,
      h1_heading: `${businessType} Services`,
      keywords: [`${businessType}`, location]
    };
  }
};
