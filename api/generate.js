import { GoogleGenerativeAI } from '@google/generative-ai';

// Vercel Edge Runtime configuration
export const config = {
  runtime: 'edge',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// Define CORS headers
const CORS_HEADERS = {
    // IMPORTANT: Allow all domains for public API access
    'Access-Control-Allow-Origin': '*', 
    // Allow POST and OPTIONS methods
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Allow necessary headers
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
    'Content-Type': 'application/json',
};

// Main handler function
export default async function handler(request) {
    
    // =========================================================
    // CORS Preflight Handler (OPTIONS) - No key required
    // =========================================================
    if (request.method === 'OPTIONS') {
        // Return 204 No Content with CORS headers for successful handshake
        return new Response(null, {
            status: 204, 
            headers: CORS_HEADERS,
        });
    }
    
    // =========================================================
    // POST Request Handler (Requires API Key check)
    // =========================================================
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: CORS_HEADERS
        });
    }

    try {
        const { context, isFile, lang } = await request.json();
        
        // Check for missing API Key (checked after OPTIONS to avoid 401 on preflight)
        if (!GEMINI_API_KEY) {
            console.error("Server API Key is missing from Environment Variables!");
            return new Response(JSON.stringify({ error: 'Server API Key is missing' }), { 
                status: 500, 
                headers: CORS_HEADERS, 
            });
        }
        
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        
        const targetLang = lang === 'en' ? "English" : "Vietnamese";
        let prompt = "";
        
        const safeContext = context.substring(0, 25000); 
        if (isFile) {
            prompt = `Analyze this text and extract 5-10 key concepts for flashcards.\nText: \"${safeContext}...\"\nIMPORTANT: Output language must be ${targetLang}.\nOutput STRICTLY JSON Array: [{\"front\": \"Question/Term\", \"back\": \"Answer/Definition\"}].\nNo markdown.`;
        } else {
            prompt = `Create 5 flashcards about: \"${context}\". \nIMPORTANT: Output language must be ${targetLang}.\nOutput STRICTLY JSON Array: [{\"front\": \"Question\", \"back\": \"Answer\"}]. \nNo markdown.`;
        }
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Use regex to robustly extract the JSON array from model's output
        const jsonMatch = text.match(/\\[[\\s\\S]*?\\]/s); 
        
        if (!jsonMatch || jsonMatch.length === 0) {
            throw new Error(`AI output format error: Model did not return a valid JSON array. Received text start: ${text.substring(0, 50)}...`);
        }
        
        const jsonString = jsonMatch[0];
        const cards = JSON.parse(jsonString);
        
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: CORS_HEADERS,
        });

    } catch (e) {
        // Log API error details
        console.error("API Proxy Error:", e); 
        
        const errorMessage = e.message || 'Internal Server Error during AI processing.';
        let status = 500;
        let responseError = `Server Error: ${errorMessage}`;
        
        // Check for Quota Exceeded or Rate Limit errors (Professional handling)
        if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429')) {
             status = 429;
             responseError = 'Quota Limit Exceeded. Please try again later.';
        }
        
        // Check for API Key validity errors
        if (errorMessage.includes('API key not valid')) {
             responseError = 'Invalid/Expired API Key (Check Vercel Environment Variables)';
        }

        // Return appropriate status code and error message
        return new Response(JSON.stringify({ error: responseError }), { 
            status: status, 
            headers: CORS_HEADERS,
        });
    }
}
