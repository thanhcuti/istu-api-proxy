import { GoogleGenerativeAI } from '@google/generative-ai';

// Vercel Edge Runtime configuration
export const config = {
  runtime: 'edge',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// Define CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
    'Content-Type': 'application/json',
};

export default async function handler(request) {
    
    // Handle Preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204, 
            headers: CORS_HEADERS,
        });
    }
    
    // Only allow POST requests
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: CORS_HEADERS
        });
    }

    try {
        // Extract cardCount from request, default to 5 if not provided
        const { context, isFile, lang, cardCount = 5 } = await request.json();
        
        // Validate API Key
        if (!GEMINI_API_KEY) {
            console.error("Server API Key is missing!");
            return new Response(JSON.stringify({ error: 'Server API Key is missing' }), { 
                status: 500, 
                headers: CORS_HEADERS, 
            });
        }
        
        // Ensure cardCount is within safe limits (4-10)
        const count = Math.min(Math.max(cardCount, 4), 10);

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        
        const targetLang = lang === 'en' ? "English" : "Vietnamese";
        let prompt = "";
        
        // Limit context length to avoid token overflow
        const safeContext = context.substring(0, 30000); 

        // Construct dynamic prompt based on user input and card count
        if (isFile) {
            prompt = `Analyze this text and extract ${count} key concepts for flashcards.\nText: \"${safeContext}...\"\nIMPORTANT: Output language must be ${targetLang}.\nOutput STRICTLY JSON Array: [{\"front\": \"Question/Term\", \"back\": \"Answer/Definition\"}].\nNo markdown.`;
        } else {
            prompt = `Create ${count} flashcards about: \"${context}\". \nIMPORTANT: Output language must be ${targetLang}.\nOutput STRICTLY JSON Array: [{\"front\": \"Question\", \"back\": \"Answer\"}]. \nNo markdown.`;
        }
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Robust JSON extraction using Regex
        const jsonMatch = text.match(/\\[[\\s\\S]*?\\]/s); 
        
        if (!jsonMatch || jsonMatch.length === 0) {
            throw new Error(`AI output format error: Model did not return a valid JSON array.`);
        }
        
        const jsonString = jsonMatch[0];
        const cards = JSON.parse(jsonString);
        
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: CORS_HEADERS,
        });

    } catch (e) {
        console.error("API Proxy Error:", e); 
        
        const errorMessage = e.message || 'Internal Server Error';
        let status = 500;
        let responseError = `Server Error: ${errorMessage}`;
        
        // Handle Quota/Rate Limit errors gracefully
        if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('429')) {
             status = 429;
             responseError = 'Quota Limit Exceeded. Please try again later.';
        }

        return new Response(JSON.stringify({ error: responseError }), { 
            status: status, 
            headers: CORS_HEADERS,
        });
    }
}
