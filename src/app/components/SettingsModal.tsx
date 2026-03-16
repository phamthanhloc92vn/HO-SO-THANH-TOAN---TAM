"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Save, Key, Link2, Box, CheckCircle2, Loader2 } from "lucide-react";

interface Settings {
    apiKey: string;
    model: string;
    scriptUrl: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: Settings) => void;
}

const ACCENT = '#4f46e5';

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
    const [settings, setSettings] = useState<Settings>({
        apiKey: "",
        model: "gpt-4.1-mini",
        scriptUrl: "https://script.google.com/macros/s/AKfycbzDGZ-ZaDq1glP7A9UvnraC8KDXsbui5V6_Z29dupXaW_yfd9tA9iIuMR74qbkxGdqZ/exec",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [apiTestStatus, setApiTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "ERROR">("IDLE");
    const [scriptTestStatus, setScriptTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "ERROR">("IDLE");

    useEffect(() => {
        const saved = localStorage.getItem("contract_ai_settings");
        if (saved) {
            try { setSettings(JSON.parse(saved)); }
            catch { console.error("Failed to parse settings"); }
        }
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(r => setTimeout(r, 600));
        localStorage.setItem("contract_ai_settings", JSON.stringify(settings));
        onSave(settings);
        setIsSaving(false);
        onClose();
    };

    const handleTestApi = async () => {
        if (!settings.apiKey) return;
        setApiTestStatus("TESTING");
        await new Promise(r => setTimeout(r, 800));
        setApiTestStatus(settings.apiKey.startsWith("sk-") ? "SUCCESS" : "ERROR");
        setTimeout(() => setApiTestStatus("IDLE"), 3000);
    };

    const handleTestScript = async () => {
        if (!settings.scriptUrl) return;
        setScriptTestStatus("TESTING");
        await new Promise(r => setTimeout(r, 800));
        setScriptTestStatus(settings.scriptUrl.includes("script.google.com") ? "SUCCESS" : "ERROR");
        setTimeout(() => setScriptTestStatus("IDLE"), 3000);
    };

    const inputClasses = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-sm";

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ type: "spring", damping: 28, stiffness: 350 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
                    >
                        <div className="rounded-2xl p-7 relative overflow-hidden"
                            style={{
                                background: 'rgba(255,255,255,0.85)',
                                backdropFilter: 'blur(24px)',
                                border: '1px solid rgba(0,0,0,0.06)',
                                boxShadow: '0 24px 48px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.04)',
                            }}
                        >
                            {/* Top accent line */}
                            <div className="absolute top-0 left-0 right-0 h-[3px]"
                                style={{ background: `linear-gradient(90deg, ${ACCENT}, #6366f1, #818cf8)` }} />

                            {/* Header */}
                            <div className="flex justify-between items-center mb-7">
                                <h2 className="text-xl font-bold tracking-tight" style={{ color: '#1a1a2e' }}>Cấu hình</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                                    style={{ color: '#9ca3af' }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* API Key */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                                        <Key className="w-4 h-4" style={{ color: ACCENT }} /> OpenAI API Key
                                    </label>
                                    <div className="relative flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={settings.apiKey}
                                                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                                placeholder="sk-..."
                                                className={`${inputClasses} font-mono pr-10`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleTestApi}
                                            disabled={!settings.apiKey || apiTestStatus === "TESTING"}
                                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors flex items-center justify-center min-w-[80px] text-sm"
                                        >
                                            {apiTestStatus === "TESTING" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                apiTestStatus === "SUCCESS" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                                                    apiTestStatus === "ERROR" ? <span className="text-red-500 text-xs">Lỗi</span> :
                                                        <span>Test</span>}
                                        </button>
                                    </div>
                                    <p className="text-xs mt-1.5 ml-1" style={{ color: '#9ca3af' }}>Dùng để kết nối với model GPT-4o cho tác vụ AI.</p>
                                </div>

                                {/* Model */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                                        <Box className="w-4 h-4 text-amber-500" /> AI Model
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={settings.model}
                                            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                            className={`${inputClasses} appearance-none cursor-pointer`}
                                        >
                                            <option value="gpt-4.1-mini">GPT-4.1 Mini (Khuyên dùng)</option>
                                            <option value="gpt-4o">gpt-4o (Khuyên dùng)</option>
                                            <option value="gpt-4-turbo">gpt-4-turbo</option>
                                            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                                    </div>
                                </div>

                                {/* Script URL */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                                        <Link2 className="w-4 h-4 text-blue-500" /> Google Apps Script URL
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={settings.scriptUrl}
                                            onChange={(e) => setSettings({ ...settings, scriptUrl: e.target.value })}
                                            placeholder="https://script.google.com/macros/s/..."
                                            className={`${inputClasses} flex-1 font-mono text-xs`}
                                        />
                                        <button
                                            onClick={handleTestScript}
                                            disabled={!settings.scriptUrl || scriptTestStatus === "TESTING"}
                                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors flex items-center justify-center min-w-[80px] text-sm"
                                        >
                                            {scriptTestStatus === "TESTING" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                scriptTestStatus === "SUCCESS" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                                                    scriptTestStatus === "ERROR" ? <span className="text-red-500 text-xs">Lỗi</span> :
                                                        <span>Test</span>}
                                        </button>
                                    </div>
                                    <p className="text-xs mt-1.5 ml-1" style={{ color: '#9ca3af' }}>Đường dẫn Web App để đẩy dữ liệu lên Google Sheets.</p>
                                </div>
                            </div>

                            {/* Save */}
                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-7 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                        background: `linear-gradient(135deg, ${ACCENT}, #6366f1)`,
                                        boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
                                    }}
                                >
                                    {isSaving ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
                                    ) : (
                                        <><Save className="w-4 h-4" /> Lưu cấu hình</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
