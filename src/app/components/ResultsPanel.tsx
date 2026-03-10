"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Save, Check, Sheet, AlertCircle, CheckCircle2 } from "lucide-react";

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

interface ValidationScores { [key: string]: number; }

interface ResultsPanelProps {
    dataList: ContractData[];
    validationScoresList?: ValidationScores[];
    previews?: string[];
    fileUrls?: string[];
    selectedPdfIndex?: number;
    onSelectPdf?: (i: number) => void;
    onUpdate: (index: number, data: ContractData) => void;
    onSync: () => void;
    syncStatus: "IDLE" | "SYNCING" | "SUCCESS";
}

// ── token shortcuts ──────────────────────────────────────────────────────────
const BG_SURFACE = 'rgba(14,14,14,0.96)';
const BG_CARD = 'rgba(18,18,18,0.80)';
const BORDER_DIM = '1px solid rgba(255,255,255,0.07)';
const BORDER_CYAN = '1px solid rgba(0,242,255,0.2)';
const CYAN = '#00f2ff';

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
    const [editCell, setEditCell] = useState<{ index: number; field: keyof ContractData } | null>(null);
    const [tempValue, setTempValue] = useState("");

    /* ── Empty state ─────────────────────────────────────────────────────── */
    if (!dataList || dataList.length === 0) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-16 text-center"
                style={{ background: BG_SURFACE }}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-2xl"
                >
                    {/* 3D ghost icon */}
                    <div className="w-24 h-24 rounded-3xl mx-auto mb-10 flex items-center justify-center animate-float"
                        style={{
                            background: 'rgba(18,18,18,0.8)',
                            border: BORDER_DIM,
                            boxShadow: '0 0 40px rgba(0,242,255,0.04), 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                    >
                        <Sheet className="w-12 h-12" style={{ color: 'rgba(255,255,255,0.1)' }} />
                    </div>

                    <h1 className="text-[52px] leading-[1.1] font-bold mb-6 tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, #888 0%, #fff 45%, #888 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        Tự Động Trích Xuất Dữ Liệu Hợp Đồng.
                    </h1>
                    <p className="text-lg font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Kéo thả file PDF hợp đồng vào vùng bên trái để AI bắt đầu xử lý ngay lập tức.
                    </p>
                </motion.div>
            </div>
        );
    }

    /* ── Field config ────────────────────────────────────────────────────── */
    const fields: { key: keyof ContractData; label: string }[] = [
        { key: "Số HĐ", label: "SỐ HĐ" },
        { key: "Loại HĐ", label: "LOẠI HĐ" },
        { key: "Giá trị HĐ", label: "GIÁ TRỊ HĐ" },
        { key: "Ngày ký", label: "NGÀY KÝ" },
        { key: "Bên cho thuê", label: "BÊN CHO THUÊ" },
        { key: "Khách hàng", label: "KHÁCH HÀNG" },
        { key: "Tên dự án", label: "TÊN DỰ ÁN" },
        { key: "Tóm tắt nội dung", label: "TÓM TẮT NỘI DUNG" },
        { key: "Tên File HĐ", label: "TÊN FILE HĐ" },
    ];

    const handleEdit = (index: number, field: keyof ContractData) => {
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
        <div className="h-full w-full flex flex-col p-6 overflow-auto text-white"
            style={{ background: BG_SURFACE, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Xác minh hợp đồng</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Xem lại và xác nhận dữ liệu trước khi đồng bộ
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-xl transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)', background: BG_CARD, border: BORDER_DIM }}>
                        <AlertCircle className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onSync}
                        disabled={syncStatus !== "IDLE"}
                        className="px-5 py-2.5 rounded-xl flex items-center gap-2 font-semibold text-sm transition-all"
                        style={syncStatus === "SUCCESS"
                            ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)', boxShadow: '0 0 20px rgba(16,185,129,0.1)' }
                            : { background: 'rgba(255,255,255,0.95)', color: '#0a0a0a', border: 'none', boxShadow: '0 0 30px rgba(255,255,255,0.08)' }
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

            {/* ── Body: Sidebar + Table ──────────────────────────────────── */}
            <div className="flex gap-5 items-start flex-1 min-h-0 overflow-hidden">

                {/* Left sidebar */}
                <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto h-full pb-2">
                    <div className="rounded-2xl p-4 flex flex-col gap-3"
                        style={{ background: BG_CARD, border: BORDER_DIM, boxShadow: '0 0 0 1px rgba(0,242,255,0.03), 0 20px 40px rgba(0,0,0,0.5)' }}
                    >
                        {/* Status icon */}
                        <div className="flex flex-col items-center text-center pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', boxShadow: '0 0 20px rgba(59,130,246,0.2)' }}
                            >
                                <CheckCircle2 className="w-6 h-6 text-blue-400" />
                            </div>
                            <p className="text-sm font-bold text-white">Quét hoàn tất</p>
                            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                AI trích xuất thành công
                            </p>
                        </div>

                        {/* File list */}
                        <div className="space-y-2">
                            {dataList.map((data, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onSelectPdf?.(idx)}
                                    className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all"
                                    style={idx === selectedPdfIndex
                                        ? { background: 'rgba(0,242,255,0.08)', border: BORDER_CYAN, boxShadow: '0 0 12px rgba(0,242,255,0.06)' }
                                        : { background: 'rgba(255,255,255,0.03)', border: BORDER_DIM }
                                    }
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={idx === selectedPdfIndex
                                            ? { background: 'rgba(0,242,255,0.15)', border: '1px solid rgba(0,242,255,0.25)' }
                                            : { background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.25)' }
                                        }
                                    >
                                        <Sheet className="w-3.5 h-3.5" style={{ color: idx === selectedPdfIndex ? CYAN : '#fb923c' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-semibold truncate text-white/80">
                                            {data["Số HĐ"] !== "N/A" ? data["Số HĐ"] : `File ${idx + 1}`}
                                        </p>
                                        <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>98% confidence</p>
                                    </div>
                                    {previews[idx] && (
                                        <div className="w-8 h-10 rounded flex-shrink-0 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <img src={previews[idx]} alt="" className="w-full h-full object-cover object-top opacity-40" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: BORDER_DIM }}>
                                <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Trường</p>
                                <p className="text-lg font-bold text-blue-400">{dataList.length * 8}</p>
                            </div>
                            <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: BORDER_DIM }}>
                                <p className="text-[8px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Tiết kiệm</p>
                                <p className="text-lg font-bold text-emerald-400">{dataList.length * 0.5}h</p>
                            </div>
                        </div>

                        {/* View PDF button */}
                        <button
                            onClick={() => fileUrls[selectedPdfIndex] && window.open(fileUrls[selectedPdfIndex], "_blank")}
                            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all hover:scale-[1.02]"
                            style={{
                                background: fileUrls.length ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                border: BORDER_DIM,
                                color: fileUrls.length ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                                cursor: fileUrls.length ? 'pointer' : 'not-allowed',
                            }}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />Xem file gốc PDF
                        </button>
                    </div>
                </div>

                {/* ── Data Table ─────────────────────────────────────────── */}
                <div className="flex-grow overflow-auto h-full">
                    <div className="rounded-2xl overflow-hidden"
                        style={{
                            background: BG_CARD,
                            border: BORDER_DIM,
                            boxShadow: '0 0 0 1px rgba(0,242,255,0.03), 0 0 40px rgba(0,242,255,0.02), 0 24px 60px rgba(0,0,0,0.6)',
                        }}
                    >
                        <table className="w-full border-collapse">
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
                                    {fields.map(f => (
                                        <th key={f.key} className="px-5 py-4 text-left" style={{
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            color: 'rgba(255,255,255,0.25)',
                                            letterSpacing: '0.15em',
                                            textTransform: 'uppercase',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {f.label}
                                        </th>
                                    ))}
                                    <th className="w-10" />
                                </tr>
                            </thead>
                            <tbody>
                                {dataList.map((data, index) => (
                                    <tr key={index}
                                        className="group transition-all"
                                        style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            background: index === selectedPdfIndex ? 'rgba(0,242,255,0.015)' : 'transparent',
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = index === selectedPdfIndex ? 'rgba(0,242,255,0.015)' : 'transparent'; }}
                                    >
                                        {fields.map(f => (
                                            <td key={f.key} className="px-5 py-5 cursor-text"
                                                onDoubleClick={() => handleEdit(index, f.key)}
                                            >
                                                {editCell?.index === index && editCell?.field === f.key ? (
                                                    <input
                                                        autoFocus
                                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500/40"
                                                        style={{ background: 'rgba(255,255,255,0.08)', border: BORDER_CYAN }}
                                                        value={tempValue}
                                                        onChange={e => setTempValue(e.target.value)}
                                                        onBlur={handleSave}
                                                        onKeyDown={e => e.key === "Enter" && handleSave()}
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm leading-relaxed" style={{
                                                            color: (!data[f.key] || data[f.key] === "N/A") ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.88)',
                                                            fontStyle: (!data[f.key] || data[f.key] === "N/A") ? 'italic' : 'normal',
                                                        }}>
                                                            {data[f.key] || "N/A"}
                                                        </span>
                                                        <div className="w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                            style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }} />
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-4 py-5">
                                            <button
                                                onClick={() => fileUrls[index] && window.open(fileUrls[index], "_blank")}
                                                className="transition-all hover:scale-110"
                                                style={{ color: fileUrls[index] ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)', cursor: fileUrls[index] ? 'pointer' : 'default' }}
                                                title="Xem file gốc PDF"
                                                onMouseEnter={e => { if (fileUrls[index]) (e.currentTarget as HTMLElement).style.color = CYAN; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = fileUrls[index] ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'; }}
                                            >
                                                <ExternalLink className="w-4 h-4" />
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
