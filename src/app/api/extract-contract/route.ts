import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import PDFParser from 'pdf2json';

export async function POST(request: Request) {

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
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

        const systemPrompt = `Bạn là chuyên gia OCR và trích xuất dữ liệu hồ sơ thanh toán tại Việt Nam. Nhiệm vụ: phân tích TOÀN BỘ nội dung PDF của bộ "Hồ sơ thanh toán" và trả về JSON.

## ƯU TIÊN SỐ 1: PHIẾU ĐỀ NGHỊ THANH TOÁN
⚠️ QUAN TRỌNG NHẤT: Mỗi bộ hồ sơ thanh toán LUÔN CÓ một trang "PHIẾU ĐỀ NGHỊ THANH TOÁN" (hoặc "Giấy đề nghị thanh toán"). Trang này chứa ĐẦY ĐỦ NHẤT các thông tin cần trích xuất.

Bạn PHẢI TÌM VÀ ĐỌC KỸ trang "Phiếu đề nghị thanh toán" TRƯỚC TIÊN. Cấu trúc điển hình của trang này:
- Tiêu đề: "PHIẾU ĐỀ NGHỊ THANH TOÁN" (in đậm, nằm đầu trang)
- Mã số: "TCKT/BM/..." hoặc tương tự
- Ngày: "Ngày ... / ... / ..."
- Các dòng thông tin: "Người đề nghị thanh toán:", "Đơn vị công tác:", "Nội dung thanh toán:", "Hạng mục:"
- Bảng kê chi tiết: STT | Nội dung thanh toán | Ngày Hóa Đơn | Số Hóa Đơn | Số tiền | Ghi chú
- Dòng "Tổng" ở cuối bảng
- Hình thức thanh toán: Tiền mặt □ / Chuyển khoản □
- Phần chuyển khoản: "Đơn vị/Cá nhân nhận tiền:", "Số tài khoản:", "Tại Ngân hàng:"
- Dòng "Số tiền đề nghị thanh toán:" (CON SỐ CHÍNH XÁC NHẤT)
- Các ô ký: TRƯỞNG ĐƠN VỊ | KẾ TOÁN TRƯỞNG | PHỤ TRÁCH ĐƠN VỊ | NGƯỜI ĐỀ NGHỊ

HÃY TRÍCH XUẤT DỮ LIỆU TỪ TRANG NÀY LÀ CHÍNH. Chỉ dùng các trang khác (hóa đơn, hợp đồng, biên bản) để bổ sung thông tin còn thiếu.

## TRƯỜNG DỮ LIỆU CẦN TRÍCH XUẤT:
Trả về object "data" với 11 key sau (tiếng Việt có dấu, chính xác tuyệt đối):
"Ngày đề nghị", "Người nhận tiền", "Nội dung thanh toán", "Số tiền đề nghị thanh toán", "Dự án", "Người đề nghị thanh toán", "Đơn vị công tác", "Số tài khoản", "Tại Ngân hàng", "Hạn Thanh toán", "Danh mục hs kèm theo"

## CHIẾN LƯỢC TÌM TỪNG TRƯỜNG:

### 1. "Ngày đề nghị"
- Tìm ngày trên "Giấy đề nghị thanh toán", "Phiếu đề nghị thanh toán" hoặc tiêu đề tài liệu
- Thường ở cuối hoặc đầu tài liệu: "Ngày ... tháng ... năm ..."
- BẮT BUỘC trả về dạng "DD/MM/YYYY". VD: "ngày 13 tháng 3 năm 2026" → "13/03/2026"

### 2. "Người nhận tiền"
- Tìm trong mục "Người nhận tiền", "Đơn vị thụ hưởng", "Tên người hưởng", "Người thụ hưởng"
- Có thể là cá nhân hoặc công ty

### 3. "Nội dung thanh toán"
- Tìm trong mục "Nội dung", "Nội dung thanh toán", "Diễn giải", "Lý do thanh toán", "V/v", "Về việc", "Trích yếu"
- Tóm tắt ngắn gọn nội dung thanh toán (VD: "Tiếp khách", "Thanh toán hợp đồng thuê xe", "Chi phí công tác phí")

### 4. "Số tiền đề nghị thanh toán" — TRƯỜNG QUAN TRỌNG NHẤT
Quét TOÀN BỘ tài liệu theo thứ tự ưu tiên:
1. Tìm "Số tiền đề nghị", "Tổng số tiền", "Số tiền thanh toán", "Số tiền đề nghị thanh toán", "Tổng cộng", "Thành tiền"
2. Tìm số tiền lớn nhất đi kèm VND/VNĐ/đồng/USD
3. Tìm trong bảng: dòng cuối (TỔNG CỘNG) của bảng chi tiết
4. Tìm số tiền viết bằng chữ: "Năm triệu đồng" → 5.000.000
⚠️ TUYỆT ĐỐI KHÔNG trả "N/A" nếu có BẤT KỲ con số nào đi kèm đơn vị tiền tệ
⚠️ Chỉ trả về CON SỐ, không kèm đơn vị. VD: "200000" hoặc "5000000" (không dùng dấu phân cách)

### 5. "Dự án"
- Tìm "Dự án", "Công trình", "Tên dự án", "Project" trong toàn bộ tài liệu
- VD: "Tây Ninh", "Dự án Điện gió Trung Nam", "Nhà máy điện mặt trời..."

### 6. "Người đề nghị thanh toán"
- Tìm "Người đề nghị", "Người lập", "Người yêu cầu" — thường là người ký ở cuối đơn đề nghị
- Phân biệt với "Người nhận tiền" (có thể trùng hoặc khác nhau)

### 7. "Đơn vị công tác"
- Tìm "Phòng/Ban", "Đơn vị", "Bộ phận" — phòng ban của người đề nghị
- VD: "KHDA", "Phòng Kế toán", "Ban Quản lý Dự án"

### 8. "Số tài khoản"
- Tìm "Số TK", "STK", "Số tài khoản", "Account number"
- Thường là dãy số 10-20 chữ số

### 9. "Tại Ngân hàng"
- Tìm "Ngân hàng", "NH", "Bank", "Tại NH"
- VD: "NH TCB", "Vietcombank", "BIDV Chi nhánh..."

### 10. "Hạn Thanh toán"
- Tìm "Hạn thanh toán", "Thời hạn thanh toán", "Thanh toán trước ngày", "Deadline"
- Nếu không tìm thấy → trả "N/A"
- BẮT BUỘC dạng "DD/MM/YYYY" nếu có

### 11. "Danh mục hs kèm theo"
- BẮT BUỘC PHẢI QUÉT TOÀN BỘ NỘI DUNG hồ sơ để kiểm tra.
- Nếu CÓ "Hóa đơn giá trị gia tăng" (hoặc "Hóa đơn GTGT") trong hồ sơ, hãy ghi kết quả trả về trường này (có thể kèm các tài liệu khác, VD: "Đề nghị TT + Hóa đơn giá trị gia tăng", "Hóa đơn GTGT").
- Tương tự, liệt kê các tài liệu khác (nếu có) như Đề nghị TT, HĐ, BBNT...
- Nếu KHÔNG CÓ hóa đơn trong toàn bộ hồ sơ, bạn BẮT BUỘC trả kết quả ghi là: "Không hóa đơn".
- Từ viết tắt phổ biến: TT = Thanh toán, HĐ = Hợp đồng, BBNT = Biên bản nghiệm thu

## CẤU TRÚC JSON BẮT BUỘC:
{
  "data": {
    "Ngày đề nghị": "...",
    "Người nhận tiền": "...",
    "Nội dung thanh toán": "...",
    "Số tiền đề nghị thanh toán": "...",
    "Dự án": "...",
    "Người đề nghị thanh toán": "...",
    "Đơn vị công tác": "...",
    "Số tài khoản": "...",
    "Tại Ngân hàng": "...",
    "Hạn Thanh toán": "...",
    "Danh mục hs kèm theo": "..."
  },
  "validationScores": {
    "Ngày đề nghị": 90,
    "Người nhận tiền": 85,
    "Nội dung thanh toán": 90,
    "Số tiền đề nghị thanh toán": 95,
    "Dự án": 80,
    "Người đề nghị thanh toán": 85,
    "Đơn vị công tác": 80,
    "Số tài khoản": 85,
    "Tại Ngân hàng": 85,
    "Hạn Thanh toán": 75,
    "Danh mục hs kèm theo": 80
  }
}`;

        const userContent: any[] = [];

        // Send full text (toàn bộ nội dung text, tối đa 100,000 ký tự)
        if (text && text.trim().length > 0) {
            userContent.push({ type: "text", text: `PHẦN VĂN BẢN TRÍCH XUẤT TỪ PDF (${text.length} ký tự):\n\n${text.substring(0, 100000)}` });
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
            userContent.push({ type: "text", text: `Dưới đây là ${pageImagesFound.length} trang ảnh từ file PDF hồ sơ thanh toán. Hãy phân tích KỸ TẤT CẢ các trang để tìm thông tin thanh toán, đặc biệt chú ý số tiền, người nhận tiền, số tài khoản, và danh mục hồ sơ kèm theo:` });
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
