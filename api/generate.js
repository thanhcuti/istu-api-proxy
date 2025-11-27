import { GoogleGenerativeAI } from '@google/generative-ai';

<<<<<<< HEAD
// CẤU HÌNH QUAN TRỌNG: Bắt buộc Vercel chạy ở chế độ Edge để hỗ trợ 'new Response'
export const config = {
  runtime: 'edge',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
=======
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// Thiết lập CORS Headers đầy đủ và áp dụng cho mọi phản hồi
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Cần header này để cho phép client gửi header Content-Type
>>>>>>> 22ed7cff20655280abc6a19908bb7c7e3a957a5c
    'Access-Control-Allow-Headers': 'Content-Type', 
};

export default async function handler(request) {
<<<<<<< HEAD
    // Xử lý Preflight Request (OPTIONS)
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
=======
    // 1. XỬ LÝ REQUEST OPTIONS (PREFLIGHT)
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204, // 204 No Content
>>>>>>> 22ed7cff20655280abc6a19908bb7c7e3a957a5c
            headers: CORS_HEADERS,
        });
    }

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
        const { context, isFile, lang } = await request.json();
        
        if (!GEMINI_API_KEY) {
            return new Response(JSON.stringify({ error: 'Server API Key is missing' }), { 
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }
        
        // ... (phần còn lại của logic gọi Gemini API giữ nguyên)
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        // ... (Logic Prompt) ...
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

        // 2. Thêm CORS Headers vào phản hồi thành công (Status 200)
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error("API Proxy Error:", e);
<<<<<<< HEAD
=======
        // 3. Thêm CORS Headers vào phản hồi lỗi (Status 500)
>>>>>>> 22ed7cff20655280abc6a19908bb7c7e3a957a5c
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}
