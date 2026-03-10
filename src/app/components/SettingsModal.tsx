"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Save, Key, Link2, Box, CheckCircle2, Loader2, Play } from "lucide-react";

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

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
    const [settings, setSettings] = useState<Settings>({
        apiKey: "",
        model: "gpt-4o",
        scriptUrl: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [apiTestStatus, setApiTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "ERROR">("IDLE");
    const [scriptTestStatus, setScriptTestStatus] = useState<"IDLE" | "TESTING" | "SUCCESS" | "ERROR">("IDLE");

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("contract_ai_settings");
        if (saved) {
            try {
                setSettings(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse settings");
            }
        }
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate save delay
        await new Promise(r => setTimeout(r, 800));
        localStorage.setItem("contract_ai_settings", JSON.stringify(settings));
        onSave(settings);
        setIsSaving(false);
        onClose();
    };

    const handleTestApi = async () => {
        if (!settings.apiKey) return;
        setApiTestStatus("TESTING");
        // Simulate ping
        await new Promise(r => setTimeout(r, 1000));
        setApiTestStatus(settings.apiKey.startsWith("sk-") ? "SUCCESS" : "ERROR");
        setTimeout(() => setApiTestStatus("IDLE"), 3000);
    };

    const handleTestScript = async () => {
        if (!settings.scriptUrl) return;
        setScriptTestStatus("TESTING");
        // Simulate ping
        await new Promise(r => setTimeout(r, 1000));
        setScriptTestStatus(settings.scriptUrl.includes("script.google.com") ? "SUCCESS" : "ERROR");
        setTimeout(() => setScriptTestStatus("IDLE"), 3000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Content - Glassmorphism Fintech Style */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
                    >
                        <div className="bg-[#0f1423]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                            {/* Decorative top glow */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-cyan via-blue-500 to-neon-yellow opacity-50" />

                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold text-white tracking-tight">Configuration</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* API Key Field */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                        <Key className="w-4 h-4 text-neon-cyan" /> OpenAI API Key
                                    </label>
                                    <div className="relative flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={settings.apiKey}
                                                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                                placeholder="sk-..."
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50 transition-all font-mono text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleTestApi}
                                            disabled={!settings.apiKey || apiTestStatus === "TESTING"}
                                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center min-w-[100px]"
                                        >
                                            {apiTestStatus === "TESTING" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                apiTestStatus === "SUCCESS" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                                                    apiTestStatus === "ERROR" ? <span className="text-red-400 text-sm">Failed</span> :
                                                        <span className="text-sm">Test</span>}
                                        </button>
                                    </div>
                                    <p className="text-xs text-white/40 mt-1.5 ml-1">Dùng để kết nối với model GPT-4o cho tác vụ AI.</p>
                                </div>

                                {/* Model Selector */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                        <Box className="w-4 h-4 text-neon-yellow" /> AI Model
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={settings.model}
                                            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50 transition-all cursor-pointer"
                                        >
                                            <option value="gpt-4o" className="bg-[#0f1423] text-white">gpt-4o (Recommended)</option>
                                            <option value="gpt-4-turbo" className="bg-[#0f1423] text-white">gpt-4-turbo</option>
                                            <option value="gpt-3.5-turbo" className="bg-[#0f1423] text-white">gpt-3.5-turbo</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                                            ▼
                                        </div>
                                    </div>
                                </div>

                                {/* Apps Script URL Field */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                        <Link2 className="w-4 h-4 text-blue-400" /> Google Apps Script URL
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={settings.scriptUrl}
                                            onChange={(e) => setSettings({ ...settings, scriptUrl: e.target.value })}
                                            placeholder="https://script.google.com/macros/s/..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50 transition-all font-mono text-xs"
                                        />
                                        <button
                                            onClick={handleTestScript}
                                            disabled={!settings.scriptUrl || scriptTestStatus === "TESTING"}
                                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center min-w-[100px]"
                                        >
                                            {scriptTestStatus === "TESTING" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                scriptTestStatus === "SUCCESS" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                                                    scriptTestStatus === "ERROR" ? <span className="text-red-400 text-sm">Failed</span> :
                                                        <span className="text-sm">Test</span>}
                                        </button>
                                    </div>
                                    <p className="text-xs text-white/40 mt-1.5 ml-1">Đường dẫn Web App để đẩy dữ liệu lên Google Sheets.</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-10 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="relative px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/20 to-neon-yellow/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" /> Save Configuration
                                        </>
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
