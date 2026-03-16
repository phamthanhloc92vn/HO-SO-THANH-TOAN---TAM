"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { Settings } from "lucide-react";
import UploadPanel from "./components/UploadPanel";
import ResultsPanel from "./components/ResultsPanel";
import SettingsModal from "./components/SettingsModal";


export interface PaymentDossierData {
  "Ngày đề nghị": string;
  "Người nhận tiền": string;
  "Nội dung thanh toán": string;
  "Số tiền đề nghị thanh toán": string;
  "Dự án": string;
  "Người đề nghị thanh toán": string;
  "Đơn vị công tác": string;
  "Số tài khoản": string;
  "Tại Ngân hàng": string;
  "Hạn Thanh toán": string;
  "Danh mục hs kèm theo": string;
  "Tên File PDF": string;
}

// Normalize Vietnamese text date → DD/MM/YYYY
function normalizeDate(raw: string): string {
  if (!raw || raw === "N/A") return raw;

  // Already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) return raw.trim();

  // D/M/YYYY or D/M/YY
  const slashMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, "0");
    const m = slashMatch[2].padStart(2, "0");
    const y = slashMatch[3].length === 2 ? "20" + slashMatch[3] : slashMatch[3];
    return `${d}/${m}/${y}`;
  }

  // "ngày X tháng Y năm Z"
  const viMatch = raw.match(/(?:ng[àa]y\s+(\d{1,2})\s+)?[Tt]h[àa]ng\s+(\d{1,2})\s+[Nn]ă[mn]\s+(\d{4})/);
  if (viMatch) {
    const d = viMatch[1] ? viMatch[1].padStart(2, "0") : "01";
    const m = viMatch[2].padStart(2, "0");
    const y = viMatch[3];
    return `${d}/${m}/${y}`;
  }

  return raw;
}


export default function Home() {
  const [status, setStatus] = useState<"IDLE" | "PROCESSING" | "SUCCESS">("IDLE");
  const [processingText, setProcessingText] = useState("");
  const [extractedData, setExtractedData] = useState<PaymentDossierData[]>([]);
  const [validationScores, setValidationScores] = useState<Record<string, number>[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "SUCCESS">("IDLE");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleUpload = async (files: File[]) => {
    const savedSettings = localStorage.getItem("contract_ai_settings");
    if (!savedSettings) {
      alert("Vui lòng cấu hình OpenAI API Key trong Settings trước.");
      setIsSettingsOpen(true);
      return;
    }
    const settings = JSON.parse(savedSettings);
    if (!settings.apiKey) {
      alert("Vui lòng nhập OpenAI API Key trong Settings.");
      setIsSettingsOpen(true);
      return;
    }

    setStatus("PROCESSING");
    const newData: PaymentDossierData[] = [...extractedData];
    const newScores: Record<string, number>[] = [...validationScores];
    const newPreviews: string[] = [...previews];
    const newFileUrls: string[] = [...fileUrls];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingText(`Đang xử lý file ${i + 1}/${files.length} (${file.name})...`);

      try {
        const fileUrl = URL.createObjectURL(file);
        newFileUrls.push(fileUrl);
        setFileUrls([...newFileUrls]);

        // pdfjs-dist v4 - compatible with Webpack bundling
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        // Render page 1 for thumbnail
        const page1 = await pdf.getPage(1);
        const thumbViewport = page1.getViewport({ scale: 1.0 });
        const thumbCanvas = document.createElement("canvas");
        const thumbCtx = thumbCanvas.getContext("2d");
        thumbCanvas.height = thumbViewport.height;
        thumbCanvas.width = thumbViewport.width;
        if (thumbCtx) {
          await page1.render({ canvasContext: thumbCtx, viewport: thumbViewport }).promise;
        }
        const previewBase64 = thumbCanvas.toDataURL("image/jpeg", 0.7);
        newPreviews.push(previewBase64);
        setPreviews([...newPreviews]);

        // ===== BƯỚC 1: Trích xuất TEXT (cho PDF có text layer) =====
        setProcessingText(`Đang trích xuất văn bản từ ${totalPages} trang PDF...`);
        const allPageTexts: string[] = [];
        for (let p = 1; p <= totalPages; p++) {
          const pdfPage = await pdf.getPage(p);
          const textContent = await pdfPage.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          allPageTexts.push(`--- TRANG ${p} ---\n${pageText}`);
        }
        const fullText = allPageTexts.join("\n\n");
        const hasText = fullText.replace(/---\s*TRANG\s*\d+\s*---/g, "").trim().length > 100;

        // ===== BƯỚC 2: Render ảnh các trang PDF (cho PDF scan / ảnh) =====
        // Chỉ render ảnh nếu PDF không có text layer đủ dài (PDF scan)
        // Hoặc luôn render ảnh để AI có thể đọc visual
        const maxPagesForImages = Math.min(totalPages, 20);
        setProcessingText(`Đang render ${maxPagesForImages} trang PDF thành ảnh...`);
        const pageImages: string[] = [];
        for (let p = 1; p <= maxPagesForImages; p++) {
          const pdfPage = await pdf.getPage(p);
          const vp = pdfPage.getViewport({ scale: 1.0 });
          const pageCanvas = document.createElement("canvas");
          const pageCtx = pageCanvas.getContext("2d");
          pageCanvas.height = vp.height;
          pageCanvas.width = vp.width;
          if (pageCtx) {
            await pdfPage.render({ canvasContext: pageCtx, viewport: vp }).promise;
          }
          pageImages.push(pageCanvas.toDataURL("image/jpeg", 0.6));
        }

        // ===== BƯỚC 3: Gọi OpenAI API TRỰC TIẾP từ trình duyệt =====
        // Bypass hoàn toàn Vercel 4.5MB limit!
        setProcessingText(`AI đang phân tích hồ sơ thanh toán...`);

        const systemPrompt = `Bạn là chuyên gia OCR và trích xuất dữ liệu hồ sơ thanh toán tại Việt Nam. Nhiệm vụ: phân tích TOÀN BỘ nội dung PDF của bộ "Hồ sơ thanh toán" và trả về JSON.

## ƯU TIÊN SỐ 1: PHIẾU ĐỀ NGHỊ THANH TOÁN
⚠️ QUAN TRỌNG NHẤT: Mỗi bộ hồ sơ thanh toán LUÔN CÓ một trang "PHIẾU ĐỀ NGHỊ THANH TOÁN" (hoặc "Giấy đề nghị thanh toán"). Trang này chứa ĐẦY ĐỦ NHẤT các thông tin cần trích xuất.

Bạn PHẢI TÌM VÀ ĐỌC KỸ trang "Phiếu đề nghị thanh toán" TRƯỚC TIÊN. Cấu trúc điển hình:
- Tiêu đề: "PHIẾU ĐỀ NGHỊ THANH TOÁN" (in đậm, nằm đầu trang)
- Mã số: "TCKT/BM/..." hoặc tương tự
- Ngày: "Ngày ... / ... / ..."
- Các dòng: "Người đề nghị thanh toán:", "Đơn vị công tác:", "Nội dung thanh toán:", "Hạng mục:"
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
- BẮT BUỘC trả về dạng "DD/MM/YYYY". VD: "ngày 13 tháng 3 năm 2026" → "13/03/2026"

### 2. "Người nhận tiền"
- Tìm trong mục "Người nhận tiền", "Đơn vị thụ hưởng", "Tên người hưởng", "Người thụ hưởng"

### 3. "Nội dung thanh toán"
- Tìm trong mục "Nội dung", "Nội dung thanh toán", "Diễn giải", "Lý do thanh toán", "V/v", "Về việc", "Trích yếu"
- Tóm tắt ngắn gọn nội dung thanh toán

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

### 6. "Người đề nghị thanh toán"
- Tìm "Người đề nghị", "Người lập", "Người yêu cầu" — thường là người ký ở cuối đơn đề nghị

### 7. "Đơn vị công tác"
- Tìm "Phòng/Ban", "Đơn vị", "Bộ phận" — phòng ban của người đề nghị

### 8. "Số tài khoản"
- Tìm "Số TK", "STK", "Số tài khoản", "Account number"

### 9. "Tại Ngân hàng"
- Tìm "Ngân hàng", "NH", "Bank", "Tại NH"

### 10. "Hạn Thanh toán"
- Tìm "Hạn thanh toán", "Thời hạn thanh toán", "Thanh toán trước ngày"
- Nếu không tìm thấy → trả "N/A". BẮT BUỘC dạng "DD/MM/YYYY" nếu có

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

        // Build user content: text + images
        const userContent: any[] = [];
        if (hasText) {
          userContent.push({ type: "text", text: `VĂN BẢN TRÍCH XUẤT TỪ PDF (${fullText.length} ký tự):\n\n${fullText.substring(0, 80000)}` });
        }
        if (pageImages.length > 0) {
          userContent.push({ type: "text", text: `Dưới đây là ${pageImages.length} trang ảnh từ file PDF hồ sơ thanh toán. Hãy phân tích KỸ TẤT CẢ các trang để tìm thông tin thanh toán:` });
          for (const img of pageImages) {
            userContent.push({ type: "image_url", image_url: { url: img, detail: "high" } });
          }
        }
        if (userContent.length === 0) {
          throw new Error("Không thể trích xuất nội dung từ file PDF này.");
        }

        const modelToUse = settings.model || "gpt-4o";

        // Gọi OpenAI API TRỰC TIẾP từ trình duyệt (bypass Vercel hoàn toàn)
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: modelToUse,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent }
            ]
          })
        });

        const responseText = await response.text();
        let result;
        try {
          const parsed = JSON.parse(responseText || "{}");
          if (!response.ok) {
            const errMsg = parsed.error?.message || parsed.error || `OpenAI API error ${response.status}`;
            throw new Error(String(errMsg));
          }
          // OpenAI API trả về dạng: { choices: [{ message: { content: "..." } }] }
          const aiContent = parsed.choices?.[0]?.message?.content || "{}";
          result = JSON.parse(aiContent);
        } catch (e: any) {
          if (e.message && (e.message.includes("OpenAI") || e.message.includes("API"))) throw e;
          throw new Error(`AI không trả về JSON hợp lệ (HTTP ${response.status}).`);
        }

        // Normalize dates
        if (result.data?.["Ngày đề nghị"]) {
          result.data["Ngày đề nghị"] = normalizeDate(result.data["Ngày đề nghị"]);
        }
        if (result.data?.["Hạn Thanh toán"]) {
          result.data["Hạn Thanh toán"] = normalizeDate(result.data["Hạn Thanh toán"]);
        }

        // Inject filename
        result.data["Tên File PDF"] = file.name;

        newData.push(result.data);
        newScores.push(result.validationScores || {});

        setExtractedData([...newData]);
        setValidationScores([...newScores]);

        // Auto-Sync to Google Sheets
        setProcessingText(`Đang đồng bộ Sheets cho file ${i + 1}...`);
        const scriptUrl = settings.scriptUrl || "https://script.google.com/macros/s/AKfycbzDGZ-ZaDq1glP7A9UvnraC8KDXsbui5V6_Z29dupXaW_yfd9tA9iIuMR74qbkxGdqZ/exec";

        if (scriptUrl) {
          try {
            const payload = buildSheetsPayload(result.data);
            await fetch(scriptUrl, {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch (syncError) {
            console.error("Auto-sync failed:", syncError);
          }
        }

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        alert(`Lỗi xử lý file ${file.name}: ${msg}`);
      }
    }

    setStatus("SUCCESS");
    setSyncStatus("SUCCESS");
    setTimeout(() => setSyncStatus("IDLE"), 5000);
  };

  // Build payload matching the Google Sheet columns exactly
  const buildSheetsPayload = (data: PaymentDossierData) => {
    const today = new Date();
    const ngayNhap = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

    // Định dạng số tiền: 7900000 → 7.900.000
    const formatMoney = (val: string) => {
      if (!val || val === "N/A") return val;
      const num = val.replace(/[^0-9]/g, "");
      if (!num) return val;
      return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    return {
      "Ngày nhập": ngayNhap,                                                    // B
      "Ngày đề nghị": data["Ngày đề nghị"] || "N/A",                           // C
      "Người nhận tiền": data["Người nhận tiền"] || "N/A",                      // D
      "Nội dung thanh toán": data["Nội dung thanh toán"] || "N/A",              // E
      "Số tiền đề nghị thanh toán": formatMoney(data["Số tiền đề nghị thanh toán"] || "N/A"), // F
      "Dự án": data["Dự án"] || "N/A",                                          // G
      "Người đề nghị thanh toán": data["Người đề nghị thanh toán"] || "N/A",    // H
      "Đơn vị công tác": data["Đơn vị công tác"] || "N/A",                     // I
      "Số tài khoản": data["Số tài khoản"] || "N/A",                           // J
      "Tại Ngân hàng": data["Tại Ngân hàng"] || "N/A",                         // K
      "Số tiền chuyển": "",                                                      // L - để trống
      "Hạn Thanh toán": "",                                                      // M - để trống
      "Ngày chuyển": "",                                                         // N - để trống
      "Còn lại": "",                                                             // O - để trống (kế toán tự nhập công thức)
      "Tên File PDF": data["Tên File PDF"] || "N/A",                           // P
      "Danh mục hs kèm theo": data["Danh mục hs kèm theo"] || "N/A",          // Q
    };
  };

  const handleDataUpdate = (index: number, updatedItem: PaymentDossierData) => {
    const updated = [...extractedData];
    updated[index] = updatedItem;
    setExtractedData(updated);
  };

  const handleSync = async () => {
    if (extractedData.length === 0) return;
    const savedSettings = localStorage.getItem("contract_ai_settings");
    const settings = savedSettings ? JSON.parse(savedSettings) : null;

    const scriptUrl = (settings && settings.scriptUrl) ? settings.scriptUrl : "https://script.google.com/macros/s/AKfycbzDGZ-ZaDq1glP7A9UvnraC8KDXsbui5V6_Z29dupXaW_yfd9tA9iIuMR74qbkxGdqZ/exec";

    if (!scriptUrl) {
      alert("Vui lòng cấu hình Google Apps Script URL trong Settings.");
      setIsSettingsOpen(true);
      return;
    }

    setSyncStatus("SYNCING");
    try {
      for (const data of extractedData) {
        const payload = buildSheetsPayload(data);
        await fetch(scriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSyncStatus("SUCCESS");
      setTimeout(() => setSyncStatus("IDLE"), 5000);
    } catch (error) {
      console.error("Sync error:", error);
      alert("Đồng bộ Google Sheets thất bại.");
      setSyncStatus("IDLE");
    }
  };

  return (
    <main className="relative h-screen w-full overflow-hidden" style={{ background: '#f0f2f5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Background — light gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 20% 50%, rgba(79,70,229,0.04) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 80% 30%, rgba(99,102,241,0.03) 0%, transparent 70%)'
      }} />

      {/* Settings Button — light glass */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-4 left-4 z-20 w-9 h-9 flex items-center justify-center rounded-xl transition-all group"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          color: '#9ca3af',
        }}
      >
        <Settings className="w-4 h-4 group-hover:rotate-90 group-hover:text-indigo-500 transition-all duration-500" />
      </button>

      {/* ═══ IDLE / PROCESSING: Centered Hero Layout ═══ */}
      {status !== "SUCCESS" && (
        <div className="relative z-10 h-full w-full flex flex-col items-center justify-center px-6">
          {/* Hero text */}
          {status === "IDLE" && (
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-3"
                style={{ color: '#1a1a2e' }}
              >
                Tự Động Trích Xuất<br />
                <span style={{
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Hồ Sơ Thanh Toán.
                </span>
              </h1>
              <p className="text-base" style={{ color: '#9ca3af' }}>
                AI trích xuất dữ liệu từ PDF và đồng bộ Google Sheets trong vài giây.
              </p>
            </div>
          )}

          {/* Upload Card */}
          <UploadPanel
            onUpload={handleUpload}
            status={status}
            processingText={processingText}
          />

          {/* Footer */}
          <div className="absolute bottom-5 text-center">
            <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#d1d5db' }}>
              Payment Dossier AI · Trungnam E&amp;C
            </p>
          </div>
        </div>
      )}

      {/* ═══ SUCCESS: Split Layout (40% PDF + 60% Data) ═══ */}
      {status === "SUCCESS" && (
        <div className="relative z-10 flex h-full w-full">
          {/* Left: PDF Viewer */}
          <div className="w-[40%] h-full shrink-0 p-4">
            {fileUrls.length > 0 ? (
              <div className="h-full w-full flex flex-col rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
                }}
              >
                {/* PDF Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div>
                    <h3 className="text-xs font-bold tracking-wide" style={{ color: '#374151' }}>📄 Hồ sơ thanh toán gốc</h3>
                    <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>Đối chiếu thông tin trực tiếp</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {fileUrls.length > 1 && fileUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPdfIndex(i)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all border ${i === selectedPdfIndex
                          ? 'text-indigo-600 border-indigo-300'
                          : 'text-gray-400 border-gray-200 hover:text-gray-600'}`}
                        style={{ background: i === selectedPdfIndex ? 'rgba(79,70,229,0.08)' : 'rgba(0,0,0,0.02)' }}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => { setStatus("IDLE"); setPreviews([]); setFileUrls([]); setExtractedData([]); setValidationScores([]); }}
                      className="px-3 py-1.5 text-[10px] font-bold border rounded-lg transition-all hover:text-indigo-600 hover:border-indigo-300"
                      style={{ color: '#9ca3af', borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}
                    >
                      Upload mới
                    </button>
                  </div>
                </div>
                <iframe
                  src={fileUrls[selectedPdfIndex]}
                  className="flex-1 w-full border-0"
                  title="PDF Viewer"
                />
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.04)' }}
              >
                <p className="text-sm" style={{ color: '#9ca3af' }}>Không có file PDF</p>
              </div>
            )}
          </div>

          {/* Right: Results Panel */}
          <div className="w-[60%] h-full shrink-0">
            <ResultsPanel
              dataList={extractedData}
              validationScoresList={validationScores}
              previews={previews}
              fileUrls={fileUrls}
              selectedPdfIndex={selectedPdfIndex}
              onSelectPdf={setSelectedPdfIndex}
              onUpdate={handleDataUpdate}
              onSync={handleSync}
              syncStatus={syncStatus}
            />
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(settings) => console.log("Saved config:", settings)}
      />
    </main>
  );
}

