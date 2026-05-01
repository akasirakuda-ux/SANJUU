import { GoogleGenAI } from "@google/genai";

async function generateBlackoutImage() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: 'A cozy, dark room of a cafe called "Rakuda Kissa" (Camel Cafe). The room is dim, lit only by a single flickering candle on a wooden table. In the background, a silhouette of a friendly camel is visible. The atmosphere is warm, gentle, and slightly mysterious, like a storybook illustration. Soft blue and amber tones. High quality, artistic style.',
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K"
      }
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
}

export { generateBlackoutImage };
