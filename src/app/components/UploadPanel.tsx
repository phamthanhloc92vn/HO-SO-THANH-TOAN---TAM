"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2 } from "lucide-react";

interface UploadPanelProps {
    onUpload: (files: File[]) => void;
    status: "IDLE" | "PROCESSING" | "SUCCESS";
    processingText: string;
}

const ACCENT = '#4f46e5';
const ACCENT_LIGHT = '#6366f1';

export default function UploadPanel({ onUpload, status, processingText }: UploadPanelProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
        if (files.length > 0) onUpload(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type === "application/pdf");
        if (files.length > 0) onUpload(files);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`w-full max-w-md rounded-2xl p-8 flex flex-col items-center transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
            style={{
                background: isDragging ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(20px)',
                border: isDragging ? '2px dashed rgba(79,70,229,0.5)' : '1px solid rgba(0,0,0,0.06)',
                boxShadow: isDragging
                    ? '0 12px 40px rgba(79,70,229,0.12), 0 4px 16px rgba(0,0,0,0.06)'
                    : '0 4px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <AnimatePresence mode="wait">
                {status === "IDLE" && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="flex flex-col items-center text-center w-full"
                    >
                        {/* Icon */}
                        <div className="relative mb-6">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(99,102,241,0.05) 100%)',
                                    border: '1px solid rgba(79,70,229,0.15)',
                                    boxShadow: '0 4px 16px rgba(79,70,229,0.1)',
                                }}
                            >
                                <Upload className="w-7 h-7" style={{ color: ACCENT }} />
                            </div>
                            <div className="absolute inset-0 rounded-2xl opacity-30 animate-pulse-glow" />
                        </div>

                        <h3 className="text-lg font-bold mb-1" style={{ color: '#1a1a2e' }}>
                            Tải lên Hồ sơ Thanh toán
                        </h3>
                        <p className="text-sm mb-6 leading-relaxed" style={{ color: '#9ca3af' }}>
                            Kéo thả file PDF vào đây hoặc click để chọn file
                        </p>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-white cursor-pointer"
                            style={{
                                background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_LIGHT} 100%)`,
                                boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
                            }}
                        >
                            Chọn File PDF
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="application/pdf"
                            multiple
                            className="hidden"
                        />

                        <div className="flex items-center gap-3 mt-5">
                            <div className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.06)' }} />
                            <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#d1d5db' }}>
                                PDF · Multi-page
                            </p>
                            <div className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.06)' }} />
                        </div>
                    </motion.div>
                )}

                {status === "PROCESSING" && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center text-center w-full py-4"
                    >
                        <div className="relative w-20 h-28 rounded-xl flex items-center justify-center mb-6 overflow-hidden"
                            style={{
                                background: 'rgba(79,70,229,0.04)',
                                border: '1px solid rgba(79,70,229,0.15)',
                                boxShadow: '0 4px 16px rgba(79,70,229,0.08)',
                            }}
                        >
                            <FileText className="w-10 h-10" style={{ color: 'rgba(79,70,229,0.2)' }} />
                            <div className="animate-scan" />
                        </div>

                        <div className="w-full max-w-[240px] h-1.5 rounded-full overflow-hidden mb-4"
                            style={{ background: 'rgba(0,0,0,0.06)' }}
                        >
                            <motion.div
                                className="h-full rounded-full"
                                style={{
                                    background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_LIGHT})`,
                                    boxShadow: '0 0 8px rgba(79,70,229,0.4)',
                                }}
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 12, ease: "easeInOut" }}
                            />
                        </div>
                        <p className="text-sm animate-pulse font-medium" style={{ color: ACCENT }}>
                            {processingText}
                        </p>
                    </motion.div>
                )}

                {status === "SUCCESS" && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="flex flex-col items-center text-center py-4"
                    >
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                            style={{
                                background: 'rgba(16,185,129,0.1)',
                                border: '1px solid rgba(16,185,129,0.25)',
                                boxShadow: '0 4px 16px rgba(16,185,129,0.12)',
                            }}
                        >
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold mb-1" style={{ color: '#1a1a2e' }}>Quét hoàn tất</h3>
                        <p className="text-sm" style={{ color: '#9ca3af' }}>AI đã trích xuất dữ liệu thành công.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
