"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Save, Check, Sheet, AlertCircle, CheckCircle2 } from "lucide-react";

interface PaymentDossierData {
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

interface ValidationScores { [key: string]: number; }

interface ResultsPanelProps {
    dataList: PaymentDossierData[];
    validationScoresList?: ValidationScores[];
    previews?: string[];
    fileUrls?: string[];
    selectedPdfIndex?: number;
    onSelectPdf?: (i: number) => void;
    onUpdate: (index: number, data: PaymentDossierData) => void;
    onSync: () => void;
    syncStatus: "IDLE" | "SYNCING" | "SUCCESS";
}

// ── Light Glass Tokens ──
const ACCENT = '#4f46e5';
const BG_MAIN = '#f0f2f5';
const BG_CARD = 'rgba(255,255,255,0.75)';
const BORDER = '1px solid rgba(0,0,0,0.06)';
const BORDER_ACCENT = '1px solid rgba(79,70,229,0.25)';

function formatMoney(value: string): string {
    if (!value || value === "N/A") return value;
    const num = value.replace(/[^0-9]/g, "");
    if (!num) return value;
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function ResultsPanel({
    dataList,
    validationScoresList = [],
    previews = [],
    fileUrls = [],
    selectedPdfIndex = 0,
    onSelectPdf,
    onUpdate,
    onSync,
    syncStatus,
}: ResultsPanelProps) {
    const [editCell, setEditCell] = useState<{ index: number; field: keyof PaymentDossierData } | null>(null);
    const [tempValue, setTempValue] = useState("");

    /* ── Empty state ── */
    if (!dataList || dataList.length === 0) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-16 text-center"
                style={{ background: BG_MAIN }}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-2xl"
                >
                    <div className="w-20 h-20 rounded-2xl mx-auto mb-8 flex items-center justify-center animate-float"
                        style={{
                            background: BG_CARD,
                            backdropFilter: 'blur(20px)',
                            border: BORDER,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
                        }}
                    >
                        <Sheet className="w-10 h-10" style={{ color: '#d1d5db' }} />
                    </div>

                    <h1 className="text-4xl leading-tight font-bold mb-5 tracking-tight"
                        style={{ color: '#1a1a2e' }}
                    >
                        Tự Động Trích Xuất<br />Hồ Sơ Thanh Toán.
                    </h1>
                    <p className="text-base font-medium" style={{ color: '#9ca3af' }}>
                        Kéo thả file PDF hồ sơ thanh toán vào vùng bên trái để AI bắt đầu xử lý ngay lập tức.
                    </p>
                </motion.div>
            </div>
        );
    }

    /* ── Field config ── */
    const fields: { key: keyof PaymentDossierData; label: string }[] = [
        { key: "Ngày đề nghị", label: "NGÀY ĐỀ NGHỊ" },
        { key: "Người nhận tiền", label: "NGƯỜI NHẬN TIỀN" },
        { key: "Nội dung thanh toán", label: "NỘI DUNG TT" },
        { key: "Số tiền đề nghị thanh toán", label: "SỐ TIỀN ĐỀ NGHỊ" },
        { key: "Dự án", label: "DỰ ÁN" },
        { key: "Người đề nghị thanh toán", label: "NGƯỜI ĐỀ NGHỊ" },
        { key: "Đơn vị công tác", label: "ĐƠN VỊ" },
        { key: "Số tài khoản", label: "SỐ TK" },
        { key: "Tại Ngân hàng", label: "NGÂN HÀNG" },
        { key: "Hạn Thanh toán", label: "HẠN TT" },
        { key: "Danh mục hs kèm theo", label: "DANH MỤC HS" },
        { key: "Tên File PDF", label: "TÊN FILE" },
    ];

    const handleEdit = (index: number, field: keyof PaymentDossierData) => {
        setEditCell({ index, field });
        setTempValue(dataList[index][field] || "");
    };
    const handleSave = () => {
        if (editCell) {
            onUpdate(editCell.index, { ...dataList[editCell.index], [editCell.field]: tempValue });
            setEditCell(null);
        }
    };

    return (
        <div className="h-full w-full flex flex-col p-5 overflow-auto"
            style={{ background: BG_MAIN, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold tracking-tight" style={{ color: '#1a1a2e' }}>Xác minh Hồ sơ Thanh toán</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                        Xem lại và xác nhận dữ liệu trước khi đồng bộ
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button className="p-2 rounded-xl transition-colors hover:bg-white/60"
                        style={{ color: '#9ca3af', background: BG_CARD, border: BORDER, backdropFilter: 'blur(12px)' }}>
                        <AlertCircle className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onSync}
                        disabled={syncStatus !== "IDLE"}
                        className="px-5 py-2 rounded-xl flex items-center gap-2 font-semibold text-sm transition-all"
                        style={syncStatus === "SUCCESS"
                            ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 2px 12px rgba(16,185,129,0.1)' }
                            : { background: `linear-gradient(135deg, ${ACCENT}, #6366f1)`, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(79,70,229,0.25)' }
                        }
                    >
                        {syncStatus === "SYNCING" ? (
                            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Save className="w-4 h-4" /></motion.div>Đang đồng bộ...</>
                        ) : syncStatus === "SUCCESS" ? (
                            <><Check className="w-4 h-4" />Đã đồng bộ</>
                        ) : (
                            <><Sheet className="w-4 h-4" />Đồng bộ Sheets</>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Body: Sidebar + Table ── */}
            <div className="flex gap-4 items-start flex-1 min-h-0 overflow-hidden">

                {/* Left sidebar */}
                <div className="w-52 flex-shrink-0 flex flex-col gap-3 overflow-y-auto h-full pb-2">
                    <div className="rounded-2xl p-3.5 flex flex-col gap-3"
                        style={{
                            background: BG_CARD,
                            backdropFilter: 'blur(20px)',
                            border: BORDER,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                        }}
                    >
                        {/* Status */}
                        <div className="flex flex-col items-center text-center pb-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                                style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)' }}
                            >
                                <CheckCircle2 className="w-5 h-5" style={{ color: ACCENT }} />
                            </div>
                            <p className="text-xs font-bold" style={{ color: '#1a1a2e' }}>Quét hoàn tất</p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>
                                AI trích xuất thành công
                            </p>
                        </div>

                        {/* File list */}
                        <div className="space-y-1.5">
                            {dataList.map((data, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onSelectPdf?.(idx)}
                                    className="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all"
                                    style={idx === selectedPdfIndex
                                        ? { background: 'rgba(79,70,229,0.08)', border: BORDER_ACCENT }
                                        : { background: 'rgba(0,0,0,0.02)', border: '1px solid transparent' }
                                    }
                                >
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={idx === selectedPdfIndex
                                            ? { background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)' }
                                            : { background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }
                                        }
                                    >
                                        <Sheet className="w-3 h-3" style={{ color: idx === selectedPdfIndex ? ACCENT : '#fb923c' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold truncate" style={{ color: '#374151' }}>
                                            {data["Tên File PDF"] !== "N/A" ? data["Tên File PDF"] : `File ${idx + 1}`}
                                        </p>
                                    </div>
                                    {previews[idx] && (
                                        <div className="w-6 h-8 rounded flex-shrink-0 overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                                            <img src={previews[idx]} alt="" className="w-full h-full object-cover object-top opacity-50" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2.5 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                            <div className="p-2 rounded-xl text-center" style={{ background: 'rgba(0,0,0,0.02)' }}>
                                <p className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: '#9ca3af' }}>Trường</p>
                                <p className="text-sm font-bold" style={{ color: ACCENT }}>{dataList.length * 11}</p>
                            </div>
                            <div className="p-2 rounded-xl text-center" style={{ background: 'rgba(0,0,0,0.02)' }}>
                                <p className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: '#9ca3af' }}>Tiết kiệm</p>
                                <p className="text-sm font-bold text-emerald-500">{dataList.length * 0.5}h</p>
                            </div>
                        </div>

                        {/* View PDF */}
                        <button
                            onClick={() => fileUrls[selectedPdfIndex] && window.open(fileUrls[selectedPdfIndex], "_blank")}
                            className="w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all hover:scale-[1.02]"
                            style={{
                                background: fileUrls.length ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.01)',
                                border: BORDER,
                                color: fileUrls.length ? '#6b7280' : '#d1d5db',
                                cursor: fileUrls.length ? 'pointer' : 'not-allowed',
                            }}
                        >
                            <ExternalLink className="w-3 h-3" />Xem file gốc
                        </button>
                    </div>
                </div>

                {/* ── Data Table ── */}
                <div className="flex-grow overflow-auto h-full">
                    <div className="rounded-2xl overflow-hidden"
                        style={{
                            background: BG_CARD,
                            backdropFilter: 'blur(20px)',
                            border: BORDER,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                        }}
                    >
                        <table className="w-full border-collapse">
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.015)' }}>
                                    {fields.map(f => (
                                        <th key={f.key} className="px-4 py-3 text-left" style={{
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            color: '#9ca3af',
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {f.label}
                                        </th>
                                    ))}
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {dataList.map((data, index) => (
                                    <tr key={index}
                                        className="group transition-all"
                                        style={{
                                            borderBottom: '1px solid rgba(0,0,0,0.04)',
                                            background: index === selectedPdfIndex ? 'rgba(79,70,229,0.03)' : 'transparent',
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.015)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = index === selectedPdfIndex ? 'rgba(79,70,229,0.03)' : 'transparent'; }}
                                    >
                                        {fields.map(f => (
                                            <td key={f.key} className="px-4 py-4 cursor-text"
                                                onDoubleClick={() => handleEdit(index, f.key)}
                                            >
                                                {editCell?.index === index && editCell?.field === f.key ? (
                                                    <input
                                                        autoFocus
                                                        className="w-full rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-400/40"
                                                        style={{ background: 'rgba(79,70,229,0.05)', border: BORDER_ACCENT, color: '#1a1a2e' }}
                                                        value={tempValue}
                                                        onChange={e => setTempValue(e.target.value)}
                                                        onBlur={handleSave}
                                                        onKeyDown={e => e.key === "Enter" && handleSave()}
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm leading-relaxed" style={{
                                                            color: (!data[f.key] || data[f.key] === "N/A") ? '#d1d5db' : '#374151',
                                                            fontStyle: (!data[f.key] || data[f.key] === "N/A") ? 'italic' : 'normal',
                                                        }}>
                                                            {f.key === "Số tiền đề nghị thanh toán" ? formatMoney(data[f.key] || "N/A") : (data[f.key] || "N/A")}
                                                        </span>
                                                        <div className="w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                            style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-3 py-4">
                                            <button
                                                onClick={() => fileUrls[index] && window.open(fileUrls[index], "_blank")}
                                                className="transition-all hover:scale-110"
                                                style={{ color: fileUrls[index] ? '#9ca3af' : '#e5e7eb', cursor: fileUrls[index] ? 'pointer' : 'default' }}
                                                title="Xem file gốc PDF"
                                                onMouseEnter={e => { if (fileUrls[index]) (e.currentTarget as HTMLElement).style.color = ACCENT; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = fileUrls[index] ? '#9ca3af' : '#e5e7eb'; }}
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
