import { GoogleGenerativeAI } from '@google/generative-ai';

// CẤU HÌNH QUAN TRỌNG: BUỘC Vercel chạy ở chế độ Edge Runtime
export const config = {
  runtime: 'edge',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// Định nghĩa CORS Headers
const CORS_HEADERS = {
    // 🔥 QUAN TRỌNG: Cho phép mọi domain truy cập
    'Access-Control-Allow-Origin': '*', 
    // 🔥 QUAN TRỌNG: Cho phép các phương thức POST và OPTIONS
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // 🔥 QUAN TRỌNG: Cho phép các headers cần thiết
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
    'Content-Type': 'application/json',
};

// Hàm xử lý chính
export default async function handler(request) {
    
    // =========================================================
    // 🔥 XỬ LÝ PREFLIGHT REQUEST (OPTIONS) - KHÔNG CẦN KEY
    // =========================================================
    if (request.method === 'OPTIONS') {
        // Trả về response 204 (No Content) với đầy đủ CORS headers
        // Đây là cách chuẩn để hoàn thành handshake OPTIONS thành công
        return new Response(null, {
            status: 204, 
            headers: CORS_HEADERS,
        });
    }
    
    // =========================================================
    // XỬ LÝ POST REQUEST (MỚI BẮT ĐẦU CẦN KEY)
    // =========================================================
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: CORS_HEADERS
        });
    }

    try {
        const { context, isFile, lang } = await request.json();
        
        // Kiểm tra API Key bị thiếu - CHỈ KIỂM TRA TẠI ĐÂY (SAU OPTIONS)
        if (!GEMINI_API_KEY) {
            console.error("Server API Key is missing from Environment Variables!");
            return new Response(JSON.stringify({ error: 'Server API Key is missing' }), { 
                status: 500, 
                headers: CORS_HEADERS, 
            });
        }
        
        // ... (phần còn lại của logic gọi Gemini API)
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
        
        const jsonMatch = text.match(/\\[[\\s\\S]*?\\]/s); 
        
        if (!jsonMatch || jsonMatch.length === 0) {
            throw new Error(`AI output format error: The model did not return a valid JSON array. Received text start: ${text.substring(0, 50)}...`);
        }
        
        const jsonString = jsonMatch[0];
        const cards = JSON.parse(jsonString);
        
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: CORS_HEADERS,
        });

    } catch (e) {
        console.error("API Proxy Error:", e); 
        
        const errorMessage = e.message.includes('AI output format error') 
                             ? e.message
                             : e.message.includes('API key not valid') 
                               ? 'Invalid/Expired API Key (Check Vercel Environment Variables)' 
                               : 'Internal Server Error during AI processing.';
        
        return new Response(JSON.stringify({ error: `Server Error: ${errorMessage}` }), { 
            status: 500, 
            headers: CORS_HEADERS,
        });
    }
}
