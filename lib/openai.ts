import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is missing. Generation will fail unless MOCK_SWMP=1.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
