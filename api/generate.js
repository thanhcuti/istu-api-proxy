import { GoogleGenerativeAI } from '@google/generative-ai';

// BẮT BUỘC: Đảm bảo Vercel chạy ở Edge Runtime để hỗ trợ new Response
export const config = {
  runtime: 'edge',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// Định nghĩa CORS Headers một lần
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', // Cho phép mọi domain truy cập
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // Cho phép các phương thức này
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Cho phép các header này
};

export default async function handler(request) {
    // 1. Xử lý Preflight Request (OPTIONS)
    if (request.method === 'OPTIONS') {
        // Trả về response 204 (No Content) với đầy đủ CORS headers
        return new Response(null, {
            status: 204, 
            headers: CORS_HEADERS,
        });
    }

    // 2. Xử lý POST Request
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { 
            status: 405, 
            headers: CORS_HEADERS // Vẫn phải thêm CORS headers vào lỗi 405
        });
    }

    try {
        const { context, isFile, lang } = await request.json();
        
        if (!GEMINI_API_KEY) {
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
        const text = result.response.text();
        const cards = JSON.parse(text.replace(/```json|```/g, "").trim());
        
        // Trả về kết quả thành công với CORS headers
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error("API Proxy Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}
