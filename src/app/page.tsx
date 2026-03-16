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
        // Tăng giới hạn trang lên 50 để quét toàn bộ. Vercel giới hạn là 4.5MB.
        // Cần nén ảnh cực mạnh (0.3) do quét tới 50 trang
        const pagesToScan = Math.min(totalPages, 50);

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

        // Render multiple pages for Vision
        setProcessingText(`Đang render ${pagesToScan} trang PDF...`);
        const pageImages: string[] = [];
        for (let p = 1; p <= pagesToScan; p++) {
          const pdfPage = await pdf.getPage(p);
          // Thu nhỏ scale xuống 0.7 (rộng khoảng ~500-600px) để giảm size JSON payload
          const vp = pdfPage.getViewport({ scale: 0.7 });
          const pageCanvas = document.createElement("canvas");
          const pageCtx = pageCanvas.getContext("2d");
          pageCanvas.height = vp.height;
          pageCanvas.width = vp.width;
          if (pageCtx) {
            await pdfPage.render({ canvasContext: pageCtx, viewport: vp }).promise;
          }
          // Nén cực mạnh (quality 0.3) khi quét 50 trang để tránh Vercel 4.5MB limit
          pageImages.push(pageCanvas.toDataURL("image/jpeg", 0.3));
        }
        const imageBase64 = pageImages[0];

        // Prepare Form Data
        const formData = new FormData();
        formData.append("file", file);
        pageImages.forEach((img, idx) => {
          formData.append(`image_page_${idx + 1}`, img);
        });
        formData.append("image", imageBase64);
        formData.append("total_pages_sent", String(pagesToScan));

        setProcessingText(`AI đang phân tích hồ sơ thanh toán...`);

        const response = await fetch("/api/extract-contract", {
          method: "POST",
          headers: {
            "x-api-key": settings.apiKey,
            "x-model": settings.model || "gpt-4.5-preview"
          },
          body: formData
        });

        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText || "{}");
        } catch (e) {
          throw new Error(`API Error (HTTP ${response.status}): Server did not return valid JSON.`);
        }

        if (!response.ok) {
          throw new Error(result.error || `Server error ${response.status}`);
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

