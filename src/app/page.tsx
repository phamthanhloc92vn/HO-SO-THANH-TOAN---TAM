"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { Settings } from "lucide-react";
import UploadPanel from "./components/UploadPanel";
import ResultsPanel from "./components/ResultsPanel";
import SettingsModal from "./components/SettingsModal";


interface ContractData {
  "Số HĐ": string;
  "Loại HĐ": string;
  "Giá trị HĐ": string;
  "Ngày ký": string;
  "Bên cho thuê": string;
  "Khách hàng": string;
  "Tên dự án": string;
  "Tóm tắt nội dung": string;
  "Tên File HĐ": string;
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

  // "ngày X tháng Y năm Z" or "Tháng Y năm Z"
  const viMatch = raw.match(/(?:ng[àa]y\s+(\d{1,2})\s+)?[Tt]h[àa]ng\s+(\d{1,2})\s+[Nn]ă[mn]\s+(\d{4})/);
  if (viMatch) {
    const d = viMatch[1] ? viMatch[1].padStart(2, "0") : "01";
    const m = viMatch[2].padStart(2, "0");
    const y = viMatch[3];
    return `${d}/${m}/${y}`;
  }

  // "tháng 03 năm 2025" without "ngày"
  const monthYear = raw.match(/[Tt]h[àa]ng\s+(\d{1,2})[,\s]+[Nn]ă[mn]\s+(\d{4})/);
  if (monthYear) {
    return `${monthYear[1].padStart(2, "0")}/${monthYear[2]}`;
  }

  return raw; // return as-is if cannot parse
}

export default function Home() {
  const [status, setStatus] = useState<"IDLE" | "PROCESSING" | "SUCCESS">("IDLE");
  const [processingText, setProcessingText] = useState("");
  const [extractedData, setExtractedData] = useState<ContractData[]>([]);
  const [validationScores, setValidationScores] = useState<Record<string, number>[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "SUCCESS">("IDLE");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleUpload = async (files: File[]) => {
    const savedSettings = localStorage.getItem("contract_ai_settings");
    if (!savedSettings) {
      alert("Please configure your OpenAI API Key in Settings first.");
      setIsSettingsOpen(true);
      return;
    }
    const settings = JSON.parse(savedSettings);
    if (!settings.apiKey) {
      alert("Please provide an OpenAI API Key in Settings.");
      setIsSettingsOpen(true);
      return;
    }

    setStatus("PROCESSING");
    const newData: ContractData[] = [...extractedData];
    const newScores: Record<string, number>[] = [...validationScores];
    const newPreviews: string[] = [...previews];
    const newFileUrls: string[] = [...fileUrls];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingText(`Đang xử lý file ${i + 1}/${files.length} (${file.name})...`);

      try {
        // Store original file URL for viewing
        const fileUrl = URL.createObjectURL(file);
        newFileUrls.push(fileUrl);
        setFileUrls([...newFileUrls]);

        // 1. Render PDF pages to Images (Client Side) for Vision & Preview
        // Dynamic import avoids DOMMatrix SSR error during build
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const pagesToScan = Math.min(totalPages, 8); // scan up to 8 pages to find contract value

        // Render page 1 for the sidebar thumbnail (preview)
        const page1 = await pdf.getPage(1);
        const thumbViewport = page1.getViewport({ scale: 1.0 });
        const thumbCanvas = document.createElement("canvas");
        const thumbCtx = thumbCanvas.getContext("2d");
        thumbCanvas.height = thumbViewport.height;
        thumbCanvas.width = thumbViewport.width;
        if (thumbCtx) {
          await page1.render({ canvasContext: thumbCtx, viewport: thumbViewport, canvas: thumbCanvas }).promise;
        }
        const previewBase64 = thumbCanvas.toDataURL("image/jpeg", 0.7);
        newPreviews.push(previewBase64);
        setPreviews([...newPreviews]);

        // Render multiple pages and stitch into one tall image for Vision
        setProcessingText(`Đang render ${pagesToScan} trang PDF...`);
        const pageImages: string[] = [];
        for (let p = 1; p <= pagesToScan; p++) {
          const pdfPage = await pdf.getPage(p);
          const vp = pdfPage.getViewport({ scale: 1.2 });
          const pageCanvas = document.createElement("canvas");
          const pageCtx = pageCanvas.getContext("2d");
          pageCanvas.height = vp.height;
          pageCanvas.width = vp.width;
          if (pageCtx) {
            await pdfPage.render({ canvasContext: pageCtx, viewport: vp, canvas: pageCanvas }).promise;
          }
          pageImages.push(pageCanvas.toDataURL("image/jpeg", 0.8));
        }
        // Use only first image as imageBase64 for now; send multiple via separate fields
        const imageBase64 = pageImages[0];

        // 2. Prepare Form Data — send all page images separately
        const formData = new FormData();
        formData.append("file", file);
        pageImages.forEach((img, idx) => {
          formData.append(`image_page_${idx + 1}`, img);
        });
        formData.append("image", imageBase64); // backwards compat
        formData.append("total_pages_sent", String(pagesToScan));


        const response = await fetch("/api/extract-contract", {
          method: "POST",
          headers: {
            "x-api-key": settings.apiKey,
            "x-model": settings.model || "gpt-4o"
          },
          body: formData
        });

        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText || "{}");
        } catch (e) {
          throw new Error(`API Error (HTTP ${response.status}): The server did not return valid JSON.`);
        }

        if (!response.ok) {
          throw new Error(result.error || `Server error ${response.status}`);
        }

        // Normalize "Giá trị HĐ" — unify currency unit to "đồng"
        if (result.data?.["Giá trị HĐ"]) {
          result.data["Giá trị HĐ"] = result.data["Giá trị HĐ"]
            .replace(/\s*(VNĐ|VND|vnđ|vnd|VNĐ|đ)\s*$/gi, " đồng")
            .trim();
        }

        // Normalize "Ngày ký" — convert text dates to DD/MM/YYYY
        if (result.data?.["Ngày ký"]) {
          result.data["Ngày ký"] = normalizeDate(result.data["Ngày ký"]);
        }
        // Inject filename — taken directly from the uploaded file
        result.data["Tên File HĐ"] = file.name;

        newData.push(result.data);
        newScores.push(result.validationScores || {});


        setExtractedData([...newData]);
        setValidationScores([...newScores]);

        // Auto-Sync to Google Sheets
        setProcessingText(`Đang đồng bộ Sheets cho file ${i + 1}...`);
        const scriptUrl = settings.scriptUrl || "https://script.google.com/macros/s/AKfycbyRfx_oHrkDB6EltZ1c4tjxsAlZ6M4Rk4-QSuGTN1p5lhXICpbAcd3euQ3X1Asywgxb/exec";

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

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        alert(`Error processing file ${file.name}: ${msg}`);
      }
    }

    setStatus("SUCCESS");
    setSyncStatus("SUCCESS");
    setTimeout(() => setSyncStatus("IDLE"), 5000);
  };

  // Helper: build payload with keys matching EXACTLY what the Apps Script reads
  // Script code: data["Ngày ký"], data["Bên cho Thuê"], data["Khách hàng"], data["Tên Dự Án"], data["Nội dung Tóm tắt"]
  const buildSheetsPayload = (data: ContractData) => ({
    "Số HĐ": data["Số HĐ"] || "N/A",
    "Loại HĐ": data["Loại HĐ"] || "N/A",
    "Giá trị HĐ": data["Giá trị HĐ"] || "N/A",
    "Ngày ký": data["Ngày ký"] || "N/A",           // lowercase ký — matches script
    "Bên cho Thuê": data["Bên cho thuê"] || "N/A",  // capital T — matches script
    "Khách hàng": data["Khách hàng"] || "N/A",      // lowercase h — matches script
    "Tên Dự Án": data["Tên dự án"] || "N/A",        // matches script
    "Nội dung Tóm tắt": data["Tóm tắt nội dung"] || "N/A", // matches script exactly
    "Tên File HĐ": data["Tên File HĐ"] || "N/A",
  });

  const handleDataUpdate = (index: number, updatedItem: ContractData) => {
    const updated = [...extractedData];
    updated[index] = updatedItem;
    setExtractedData(updated);
  };

  const handleSync = async () => {
    if (extractedData.length === 0) return;
    const savedSettings = localStorage.getItem("contract_ai_settings");
    const settings = savedSettings ? JSON.parse(savedSettings) : null;

    const scriptUrl = (settings && settings.scriptUrl) ? settings.scriptUrl : "https://script.google.com/macros/s/AKfycbyRfx_oHrkDB6EltZ1c4tjxsAlZ6M4Rk4-QSuGTN1p5lhXICpbAcd3euQ3X1Asywgxb/exec";

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
      alert("Failed to sync to Google Sheets.");
      setSyncStatus("IDLE");
    }
  };

  return (
    <main className="relative flex h-screen w-full overflow-hidden" style={{ background: '#050505', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Subtle radial glow background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 20% 50%, rgba(0,242,255,0.03) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 80% 30%, rgba(155,93,229,0.03) 0%, transparent 70%)'
      }} />

      {/* Settings Button */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-5 left-5 z-20 w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-[rgba(0,242,255,0.3)] hover:shadow-[0_0_15px_rgba(0,242,255,0.2)] transition-all group"
        style={{ background: 'rgba(18,18,18,0.8)', backdropFilter: 'blur(20px)' }}
      >
        <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {/* Left Panel: Upload OR PDF Viewer */}
      <div className="w-[40%] h-full shrink-0 p-4">
        {status === "SUCCESS" && fileUrls.length > 0 ? (
          <div className="h-full w-full flex flex-col rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_0_0_1px_rgba(0,242,255,0.06),0_0_40px_rgba(0,242,255,0.04),0_20px_60px_rgba(0,0,0,0.8)]" style={{ background: 'rgba(12,12,12,0.95)' }}>
            {/* PDF Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(18,18,18,0.8)' }}>
              <div>
                <h3 className="text-xs font-bold text-white/90 tracking-wide">📄 File HĐ Gốc</h3>
                <p className="text-[10px] text-white/30 mt-0.5">Đối chiếu thông tin trực tiếp</p>
              </div>
              <div className="flex items-center gap-2">
                {fileUrls.length > 1 && fileUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPdfIndex(i)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all border ${i === selectedPdfIndex
                      ? 'text-[#00f2ff] border-[rgba(0,242,255,0.3)] shadow-[0_0_10px_rgba(0,242,255,0.2)]'
                      : 'text-white/30 border-white/10 hover:text-white'}`}
                    style={{ background: i === selectedPdfIndex ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)' }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => { setStatus("IDLE"); setPreviews([]); setFileUrls([]); setExtractedData([]); setValidationScores([]); }}
                  className="px-3 py-1.5 text-[10px] font-bold text-white/30 hover:text-[#00f2ff] border border-white/10 hover:border-[rgba(0,242,255,0.25)] rounded-lg transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  Upload mới
                </button>
              </div>
            </div>
            {/* PDF Iframe */}
            <iframe
              src={fileUrls[selectedPdfIndex]}
              className="flex-1 w-full border-0"
              title="PDF Viewer"
            />
          </div>
        ) : (
          <UploadPanel
            onUpload={handleUpload}
            status={status}
            processingText={processingText}
          />
        )}
      </div>

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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(settings) => console.log("Saved config:", settings)}
      />
    </main>
  );
}
