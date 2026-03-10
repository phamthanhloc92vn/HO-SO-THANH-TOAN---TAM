"use client";

import { motion } from "framer-motion";

export default function MemphisShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Cyan Circle */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          x: [0, 10, 0],
          rotate: [0, 90, 180, 270, 360],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full border-2 border-neon-cyan opacity-40 shadow-[0_0_15px_rgba(0,242,255,0.3)]"
      />

      {/* Yellow Zigzag (SVG) */}
      <motion.div
        animate={{
          y: [0, 15, 0],
          rotate: [15, -15, 15],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[25%] left-[15%] opacity-30"
      >
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 10L10 0L20 10L30 0L40 10" stroke="#f8ff00" strokeWidth="2" />
        </svg>
      </motion.div>

      {/* Cyan Triangle */}
      <motion.div
        animate={{
          y: [0, -30, 0],
          rotate: [0, 360],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[20%] left-[8%] w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[25px] border-b-neon-cyan opacity-25"
      />

      {/* Yellow Dot Grid */}
      <div className="absolute top-[60%] left-[4%] grid grid-cols-4 gap-2 opacity-20">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-neon-yellow" />
        ))}
      </div>
    </div>
  );
}
