import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import PDFParser from 'pdf2json';

export async function POST(request: Request) {

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const imageBase64 = formData.get('image') as string; // Optional: Base64 image from client
        const apiKey = request.headers.get('x-api-key');
        const overrideModel = request.headers.get('x-model') || 'gpt-4o';

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API key' }, { status: 400 });
        }

        let text = "";
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            text = await new Promise<string>((resolve, reject) => {
                const pdfParser = new PDFParser(null, true);
                pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError?.message || "PDF Parsing failed")));
                pdfParser.on("pdfParser_dataReady", () => {
                    resolve(pdfParser.getRawTextContent());
                });
                pdfParser.parseBuffer(buffer);
            });
        }

        const openai = new OpenAI({ apiKey });

        const systemPrompt = `Bạn là chuyên gia OCR và trích xuất dữ liệu hợp đồng kinh tế tại Việt Nam. Nhiệm vụ của bạn là phân tích kỹ TOÀN BỘ nội dung hợp đồng và trả về JSON với đầy đủ thông tin.

## TRƯỜNG DỮ LIỆU CẦN TRÍCH XUẤT:
Trả về object "data" với 7 key sau (tiếng Việt có dấu, chính xác tuyệt đối):
"Số HĐ", "Loại HĐ", "Giá trị HĐ", "Ngày ký", "Bên cho thuê", "Khách hàng", "Tên dự án"

## CHIẾN LƯỢC TÌM "Giá trị HĐ" — ĐÂY LÀ TRƯỜNG QUAN TRỌNG NHẤT, BẮT BUỘC TÌM:
Hãy quét TOÀN BỘ tài liệu theo 6 chiến lược sau (theo thứ tự ưu tiên):

1. **Tìm mệnh đề tổng tiền:** "Giá trị hợp đồng", "Tổng giá trị", "Tổng tiền", "Tổng cộng", "Thành tiền", "Tổng giá trị thanh toán", "Tổng giá gói thầu", "Giá hợp đồng", "Total amount", "Contract value"
2. **Tìm trong ĐIỀU khoản:** Quét "ĐIỀU 2", "ĐIỀU 3", "ĐIỀU 4" — thường có mục "Giá trị" hoặc "Đơn giá"
3. **Tìm số tiền sau ký tự tiền tệ:** Bất kỳ số có VND/VNĐ/đồng/USD/$ đi kèm như "5.000.000.000 VNĐ", "34.173.252 VND", "$10,000"
4. **Tìm số tiền trong dấu ngoặc:** "(Bằng chữ: Năm tỷ đồng)" → "5.000.000.000 VNĐ"
5. **Tìm bằng chữ Việt:** "Năm tỷ", "Mười triệu", "Một trăm nghìn" rồi chuyển sang số
6. **Tìm trong bảng:** Dòng cuối cùng của bảng giá/bảng thanh toán thường là TỔNG CỘNG — lấy giá trị đó

⚠️ TUYỆT ĐỐI KHÔNG được trả về "N/A" cho "Giá trị HĐ" nếu trong tài liệu có BẤT KỲ con số nào đi kèm với đơn vị tiền tệ (VND/VNĐ/đồng/USD/$). Phải trả về số tiền đó.
⚠️ ĐỊNH DẠNG "Giá trị HĐ": Luôn dùng đơn vị "đồng" — ví dụ "76.344.851.648 đồng". Nếu thấy VND thì đổi thành "đồng". Nếu thấy USD thì giữ nguyên USD.

## CHIẾN LƯỢC TÌM "Bên cho thuê" / "Bên A" / "Bên cung cấp":
- Tìm "Bên A", "Bên cho thuê", "Bên bán", "Bên cung cấp", "Đơn vị cung cấp", "Bên cho thuê mặt bằng"
- Thường là công ty/cá nhân đứng phía trên trong phần "CÁC BÊN THAM GIA HỢP ĐỒNG"

## CHIẾN LƯỢC TÌM "Khách hàng" / "Bên B":
- Tìm "Bên B", "Bên thuê", "Bên mua", "Bên nhận", "Đơn vị thuê"
- Thường là: "Công ty Cổ phần Xây dựng và Lắp máy Trung Nam" hoặc tên công ty tương tự

## CÁC TRƯỜNG KHÁC:
- "Số HĐ": Ký hiệu như "01/2025/HĐTV...", "HĐKT/..."
- "Loại HĐ": Loại/Tên gọi hợp đồng ở tiêu đề, ví dụ "Hợp đồng thuê văn phòng"
- "Ngày ký": Ngày ký cuối tài liệu. BẮT BUỘC trả về dạng số "DD/MM/YYYY". Nếu thấy "ngày 5 tháng 1 năm 2026" → "05/01/2026". Nếu chỉ có "Tháng 03 năm 2025" → "03/2025".
- "Tên dự án": Tên dự án/công trình. Tìm theo thứ tự:
  1. Tìm từ khóa: "Dự án", "Công trình", "Dự án đầu tư", "Tên dự án", "Về việc", "V/v"
  2. Xem trong mục tiêu/phạm vi hợp đồng — thường ghi "Dự án [tên] tại [địa điểm]"
  3. Xem tiêu đề tài liệu hoặc phần trích yếu (ví dụ: "Về việc: thi công xây dựng dự án..." → lấy "dự án..." làm tên)
  4. Nếu không tìm thấy tên dự án cụ thể → dùng tên công trình/địa điểm thi công
  ⚠️ Nếu trong hợp đồng CÓ đề cập tên dự án hoặc công trình ở bất kỳ đâu, PHẢI trả về. Không được trả "N/A" khi có thông tin.
- "Tóm tắt nội dung": Viết một câu tóm tắt ngắn gọn mô tả mục đích của hợp đồng (ví dụ: "Cho thuê văn phòng tại ...", "Cung cấp trang thiết bị nội thất cho ..."). Tối đa 2 câu.

## CẤU TRÚC JSON BẮT BUỘC:
{
  "data": {
    "Số HĐ": "...",
    "Loại HĐ": "...",
    "Giá trị HĐ": "...",
    "Ngày ký": "...",
    "Bên cho thuê": "...",
    "Khách hàng": "...",
    "Tên dự án": "...",
    "Tóm tắt nội dung": "..."
  },
  "validationScores": {
    "Số HĐ": 95,
    "Loại HĐ": 90,
    "Giá trị HĐ": 90,
    "Ngày ký": 90,
    "Bên cho thuê": 85,
    "Khách hàng": 85,
    "Tên dự án": 80,
    "Tóm tắt nội dung": 80
  }
}`;

        const userContent: any[] = [];

        // Send full text (increased limit to 50,000 chars — covers most multi-page contracts)
        if (text && text.trim().length > 0) {
            userContent.push({ type: "text", text: `PHẦN VĂN BẢN TRÍCH XUẤT TỪ PDF (${text.length} ký tự):\n\n${text.substring(0, 50000)}` });
        }

        // Collect all page images sent by client (image_page_1, image_page_2, ...)
        const totalPagesSent = parseInt(formData.get('total_pages_sent') as string || '1', 10);
        const pageImagesFound: string[] = [];
        for (let p = 1; p <= totalPagesSent; p++) {
            const img = formData.get(`image_page_${p}`) as string;
            if (img) pageImagesFound.push(img);
        }

        // Fallback: use legacy 'image' field if no page images found
        if (pageImagesFound.length === 0) {
            const fallback = formData.get('image') as string;
            if (fallback) pageImagesFound.push(fallback);
        }

        // Add all page images to Vision payload (GPT-4o can handle multiple images)
        if (pageImagesFound.length > 0) {
            userContent.push({ type: "text", text: `Dưới đây là ${pageImagesFound.length} trang ảnh từ file PDF. Hãy phân tích KỸ TẤT CẢ các trang để tìm giá trị hợp đồng, đặc biệt chú ý đến bảng giá, ĐIỀU khoản 2-5, và số tiền bằng chữ:` });
            for (const img of pageImagesFound) {
                userContent.push({
                    type: "image_url",
                    image_url: { url: img, detail: "high" }
                });
            }
        }

        if (userContent.length === 0) {
            return NextResponse.json({ error: 'No content provided for analysis' }, { status: 400 });
        }

        const messages = [
            { role: "system" as const, content: systemPrompt },
            { role: "user" as const, content: userContent }
        ];

        // 2. Connect to OpenAI GPT-4o
        const completion = await openai.chat.completions.create({
            model: overrideModel,
            response_format: { type: "json_object" },
            messages: messages
        });

        const resultText = completion.choices[0].message.content || "{}";
        const result = JSON.parse(resultText);

        console.log("AI Response (Vision/Text):", JSON.stringify(result, null, 2));

        return NextResponse.json(result);

    } catch (error: unknown) {
        console.error('API Extraction error:', error);
        const msg = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
