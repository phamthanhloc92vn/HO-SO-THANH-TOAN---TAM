"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2 } from "lucide-react";

interface UploadPanelProps {
    onUpload: (files: File[]) => void;
    status: "IDLE" | "PROCESSING" | "SUCCESS";
    processingText: string;
}

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
        <div
            className="relative h-full w-full flex flex-col items-center justify-center p-6 overflow-hidden"
            style={{ background: '#050505' }}
        >
            {/* Background radial glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-[0.04]"
                    style={{ background: 'radial-gradient(circle, #00f2ff 0%, transparent 70%)', filter: 'blur(40px)' }} />
                <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #9b5de5 0%, transparent 70%)', filter: 'blur(30px)' }} />
            </div>

            {/* Main Glass Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`relative z-10 w-full max-w-sm rounded-3xl p-8 flex flex-col items-center transition-all duration-300 ${isDragging ? 'scale-[1.02]' : ''}`}
                style={{
                    background: 'rgba(14,14,14,0.85)',
                    backdropFilter: 'blur(28px)',
                    border: isDragging ? '1px solid rgba(0,242,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: isDragging
                        ? '0 0 0 1px rgba(0,242,255,0.15), 0 0 60px rgba(0,242,255,0.12), 0 24px 60px rgba(0,0,0,0.8)'
                        : '0 0 0 1px rgba(0,242,255,0.03), 0 24px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <AnimatePresence mode="wait">
                    {status === "IDLE" && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col items-center text-center w-full"
                        >
                            {/* 3D-style icon */}
                            <div className="relative mb-7">
                                <div className="w-20 h-20 rounded-2xl flex items-center justify-center animate-float"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(0,242,255,0.15) 0%, rgba(0,242,255,0.04) 100%)',
                                        border: '1px solid rgba(0,242,255,0.2)',
                                        boxShadow: '0 0 30px rgba(0,242,255,0.15), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <Upload className="w-9 h-9" style={{ color: '#00f2ff' }} />
                                </div>
                                {/* Glow ring */}
                                <div className="absolute inset-0 rounded-2xl opacity-20 animate-pulse-glow" />
                            </div>

                            <h3 className="text-xl font-bold mb-2"
                                style={{
                                    background: 'linear-gradient(135deg, #c0c0c0 0%, #ffffff 50%, #c0c0c0 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                            >
                                Tải lên Hợp đồng
                            </h3>
                            <p className="text-white/40 text-sm mb-7 leading-relaxed">
                                Kéo thả file PDF vào đây<br />hoặc click để chọn file
                            </p>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(0,242,255,0.2) 0%, rgba(0,242,255,0.08) 100%)',
                                    border: '1px solid rgba(0,242,255,0.35)',
                                    color: '#00f2ff',
                                    boxShadow: '0 0 20px rgba(0,242,255,0.1)',
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

                            {/* Drop hint */}
                            <p className="mt-5 text-[11px] text-white/20 font-mono tracking-widest uppercase">
                                PDF · Multi-page supported
                            </p>
                        </motion.div>
                    )}

                    {status === "PROCESSING" && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center text-center w-full"
                        >
                            {/* Animated document */}
                            <div className="relative w-28 h-36 rounded-xl flex items-center justify-center mb-8 overflow-hidden"
                                style={{
                                    background: 'rgba(18,18,18,0.8)',
                                    border: '1px solid rgba(0,242,255,0.2)',
                                    boxShadow: '0 0 30px rgba(0,242,255,0.1)',
                                }}
                            >
                                <FileText className="w-14 h-14 text-white/10" />
                                <div className="animate-scan" />
                            </div>

                            <div className="w-full max-w-[200px] h-1 rounded-full overflow-hidden mb-4"
                                style={{ background: 'rgba(255,255,255,0.06)' }}
                            >
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                        background: 'linear-gradient(90deg, #00f2ff, #9b5de5)',
                                        boxShadow: '0 0 12px rgba(0,242,255,0.5)',
                                    }}
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 12, ease: "easeInOut" }}
                                />
                            </div>
                            <p className="text-sm animate-pulse font-mono" style={{ color: '#00f2ff' }}>
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
                            className="flex flex-col items-center text-center"
                        >
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                                style={{
                                    background: 'rgba(16,185,129,0.15)',
                                    border: '1px solid rgba(16,185,129,0.4)',
                                    boxShadow: '0 0 30px rgba(16,185,129,0.2)',
                                }}
                            >
                                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">Quét hoàn tất</h3>
                            <p className="text-white/40 text-sm">AI đã trích xuất dữ liệu thành công.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Footer */}
            <div className="absolute bottom-6 z-10 text-center">
                <p className="text-white/15 text-[10px] font-mono tracking-widest uppercase">
                    Contract AI Engine · Trungnam E&amp;C
                </p>
            </div>
        </div>
    );
}
