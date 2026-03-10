import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import PDFParser from 'pdf2json';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const apiKey = request.headers.get('x-api-key');
        const overrideModel = request.headers.get('x-model') || 'gpt-4o';

        if (!file || !apiKey) {
            return NextResponse.json({ error: 'Missing file or API key' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse the PDF using pdf2json
        const text = await new Promise<string>((resolve, reject) => {
            const pdfParser = new PDFParser(null, true);
            pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError?.message || "PDF Parsing failed")));
            pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
            pdfParser.parseBuffer(buffer);
        });

        if (!text || text.trim() === '') {
            return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey });

        // 2. Connect to OpenAI GPT-4o
        const completion = await openai.chat.completions.create({
            model: overrideModel,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý trích xuất dữ liệu tài chính. Hãy phân tích văn bản hợp đồng sau và trả về DUY NHẤT một đối tượng JSON có các trường: {so_hd, loai_hd, gia_tri, ngay_ky, khach_hang}. Nếu không thấy thông tin, để là 'N/A'. Giá trị tiền tệ chỉ để số.

Trọng tâm bổ sung độ tin cậy: Kèm theo "validationScores" từ 0-100 cho mỗi trường.

Respond with exactly this JSON structure:
{
  "data": {
    "so_hd": "...",
    "loai_hd": "...",
    "gia_tri": "...",
    "ngay_ky": "...",
    "khach_hang": "..."
  },
  "validationScores": {
    "so_hd": 99,
    "loai_hd": 95,
    "gia_tri": 100,
    "ngay_ky": 90,
    "khach_hang": 85
  }
}`
                },
                {
                    role: "user",
                    content: `Văn bản hợp đồng:\n\n${text.substring(0, 15000)}`
                }
            ]
        });

        const resultText = completion.choices[0].message.content || "{}";
        const result = JSON.parse(resultText);

        return NextResponse.json(result);

    } catch (error: unknown) {
        console.error('API Extraction error:', error);
        const msg = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
