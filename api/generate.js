import { GoogleGenerativeAI } from '@google/generative-ai';

// CẤU HÌNH QUAN TRỌNG: BẮT BUỘC Vercel chạy ở chế độ Edge Runtime
export const config = {
  runtime: 'edge',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
console.log("Vercel is loading API Key starting with:", GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 4) + '...' : 'Key Not Found');

// Định nghĩa CORS Headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
};

// Hàm xử lý chính
export default async function handler(request) {
    // Xử lý Preflight Request (OPTIONS)
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204, 
            headers: CORS_HEADERS,
        });
    }

    // Xử lý Method Not Allowed (405)
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: CORS_HEADERS
        });
    }

    try {
        const { context, isFile, lang } = await request.json();
        
        if (!GEMINI_API_KEY) {
            return new Response(JSON.stringify({ error: 'Server API Key is missing. Check your Vercel Environment Variables.' }), { 
                status: 500,
                headers: CORS_HEADERS,
            });
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

        const targetLang = lang === 'en' ? "English" : "Vietnamese";
        let prompt = "";
        
        // ... (Prompt generation logic giữ nguyên)
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
        
        // SỬA LỖI: Tăng cường khả năng trích xuất JSON từ khối trả về của AI
        // Regex /\[[\s\S]*?\]/s: tìm khối Array JSON đầu tiên
        const jsonMatch = text.match(/\[[\s\S]*?\]/s); 
        
        if (!jsonMatch || jsonMatch.length === 0) {
            // NẾU AI KHÔNG TRẢ VỀ JSON: Ném lỗi để chuyển xuống catch block
            throw new Error(`AI output format error: The model did not return a valid JSON array. Received text start: ${text.substring(0, 50)}...`);
        }
        
        const jsonString = jsonMatch[0];
        const cards = JSON.parse(jsonString);
        
        // Trả về kết quả thành công
        return new Response(JSON.stringify(cards), {
            status: 200,
            headers: CORS_HEADERS,
        });

    } catch (e) {
        // XỬ LÝ LỖI CUỐI CÙNG: Đảm bảo phản hồi luôn là JSON 500
        const errorMessage = e.message.includes('API output format error') 
                             ? e.message
                             : `Server Error: ${e.message}`;

        return new Response(JSON.stringify({ error: errorMessage }), { 
            status: 500,
            headers: CORS_HEADERS,
        });
    }
}
