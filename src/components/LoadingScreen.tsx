import { motion } from "framer-motion";

/**
 * Full-screen boot splash shown while the app initializes and the hardware /
 * game catalogs are prepared for display. Fades out via AnimatePresence.
 */
export function LoadingScreen() {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-surface-900"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* Mint performance gauge with a sweeping needle */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <svg width="84" height="84" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="11" fill="#101412" />

          {/* Gauge track + filled portion */}
          <g fill="none" strokeLinecap="round">
            <path d="M11.8 33.3 A 15 15 0 1 1 36.2 33.3" stroke="#24302b" strokeWidth="5" />
            <motion.path
              d="M11.8 33.3 A 15 15 0 1 1 36.2 33.3"
              stroke="#6ee7b7"
              strokeWidth="5"
              pathLength={1}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0.15, 0.85, 0.15] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            />
          </g>

          {/* Sweeping needle */}
          <motion.g
            style={{ transformBox: "view-box", transformOrigin: "24px 30px" }}
            animate={{ rotate: [-95, 95, -95] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            <line x1="24" y1="30" x2="24" y2="13" stroke="#6ee7b7" strokeWidth="2.4" strokeLinecap="round" />
          </motion.g>
          <circle cx="24" cy="30" r="3.3" fill="#101412" stroke="#6ee7b7" strokeWidth="2.2" />
        </svg>
      </motion.div>

      {/* Title + status */}
      <div className="text-center">
        <h1 className="text-[18px] font-bold tracking-tight text-[#f5f5f5]">GSOptimizer</h1>
        <p className="mt-1 text-[12px] text-surface-400">Preparing performance data…</p>
      </div>

      {/* Indeterminate progress bar */}
      <div className="relative h-1 w-44 overflow-hidden rounded-full bg-surface-700">
        <motion.div
          className="absolute inset-y-0 w-1/2 rounded-full bg-accent-primary"
          initial={{ x: "-110%" }}
          animate={{ x: "220%" }}
          transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
