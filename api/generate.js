import { GoogleGenerativeAI } from '@google/generative-ai';

// API key from Environment Variations (Vercel Environment Variables)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// amenity function creating headers CORS 
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', // allow all domains access
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // allow POST and OPTIONS protocols
    'Access-Control-Allow-Headers': 'Content-Type', // allow send header Content-Type 
};

export default async function handler(request) {
    // 1. Processing OPTIONS (Preflight Request)
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204, // 204 No Content (valid for a successful OPTION)
            headers: CORS_HEADERS,
        });
    }

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { context, isFile, lang } = await request.json();
        
        if (!GEMINI_API_KEY) {
            // Trường hợp lỗi API Key bị thiếu trên Server
            return new Response(JSON.stringify({ error: 'Server API Key is missing' }), { 
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

        const targetLang = lang === 'en' ? "English" : "Vietnamese";
        let prompt = "";
        
        if (isFile) {
            const safeContext = context.substring(0, 25000); 
            prompt = `Analyze this text and extract 5-10 key concepts for flashcards.
            Text: "${safeContext}..."
            IMPORTANT: Output language must be ${targetLang}.
            Output STRICTLY JSON Array: [{"front": "Question/Term", "back": "Answer/Definition"}].
            No markdown.`;
        } else {
            prompt = `Create 5 flashcards about: "${context}". 
            IMPORTANT: Output language must be ${targetLang}.
            Output STRICTLY JSON Array: [{"front": "Question", "back": "Answer"}]. 
            No markdown.`;
        }
        
        const result = await model.generateContent(prompt);
        // Clean up the response from Gemini model
        const text = result.response.text();
        const cards = JSON.parse(text.replace(/```json|```/g, "").trim());
        
        // Success (Status 200)
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error("API Proxy Error:", e);
        // Error in processing (status 500)
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}
