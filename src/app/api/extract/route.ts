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

        const completion = await openai.chat.completions.create({
            model: overrideModel,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are an expert financial contract analyzer. Extract the requested fields from the provided contract text.
For each extracted field, provide a "confidence" score (0-100) indicating how certain you are. If a field is not found or ambiguous, leave the extracted string empty but with a low confidence score.

The required fields:
- id: Số Hợp Đồng (Contract ID/Number)
- type: Loại Hợp Đồng (Contract Type, e.g. EPC, Mua bán...)
- value: Giá trị Hợp Đồng (Contract Value, include currency)
- date: Ngày ký (Signing Date)
- client: Khách hàng / Chủ đầu tư / Bên B (Client/Investor)
- project: Tên dự án (Project Name)
- summary: Nội dung tóm tắt (Brief summary of the contract scope)

Respond with a JSON object in this exact structure:
{
  "data": {
    "id": "...",
    "type": "...",
    "value": "...",
    "date": "...",
    "client": "...",
    "project": "...",
    "summary": "..."
  },
  "validationScores": {
    "id": 99,
    "type": 95,
    "value": 100,
    "date": 90,
    "client": 99,
    "project": 85,
    "summary": 95
  }
}`
                },
                {
                    role: "user",
                    content: `Contract text prefix (first 15000 chars):\n\n${text.substring(0, 15000)}`
                }
            ]
        });

        const resultText = completion.choices[0].message.content || "{}";
        const result = JSON.parse(resultText);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('API Extraction error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
