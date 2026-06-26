import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ConfigurePage } from "./pages/ConfigurePage";
import { ResultsPage }   from "./pages/ResultsPage";
import { GPU_CATALOG }   from "./data/hardware/gpu";
import { CPU_CATALOG }   from "./data/hardware/cpu";
import { GAME_CATALOG }  from "./data/games/index";
import { useAppStore }   from "./store/appStore";
import type { Resolution, TargetFPS, RAMType } from "./data/types";

type View = "configure" | "results";

const VALID_RES: Resolution[] = ["1080p", "1440p", "2160p"];
const VALID_FPS: TargetFPS[]  = [30, 60, 90, 120, 144];
const VALID_RAM: number[]      = [8, 16, 32, 64];

export default function App() {
  const [view, setView] = useState<View>("configure");

  // Restore shared config from URL query params on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("gpu") || !params.has("cpu") || !params.has("game")) return;

    const store = useAppStore.getState();
    const gpu   = GPU_CATALOG.find((g) => g.id === params.get("gpu"))   ?? null;
    const cpu   = CPU_CATALOG.find((c) => c.id === params.get("cpu"))   ?? null;
    const game  = GAME_CATALOG.find((g) => g.id === params.get("game")) ?? null;
    const res   = params.get("res") as Resolution;
    const fps   = Number(params.get("fps")) as TargetFPS;
    const ram   = Number(params.get("ram"));
    const ddr   = params.get("ddr") as RAMType;

    if (VALID_RES.includes(res))          store.setResolution(res);
    if (VALID_FPS.includes(fps))          store.setTargetFPS(fps);
    if (VALID_RAM.includes(ram))          store.setRAM(ram);
    if (ddr === "DDR4" || ddr === "DDR5") store.setRAMType(ddr);
    if (gpu)  store.setGPU(gpu);
    if (cpu)  store.setCPU(cpu);
    if (game) {
      store.setGame(game);
      for (const [id, def] of Object.entries(game.settings)) {
        const t = Number(params.get(`s_${id}`));
        if (!Number.isNaN(t) && t >= 0 && t < def.tiers.length) {
          store.setSettingTier(id, t);
        }
      }
    }

    if (gpu && cpu && game) setView("results");
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface-900 overflow-hidden">
      <AnimatePresence mode="wait">
        {view === "configure" ? (
          <motion.div
            key="configure"
            className="flex flex-col h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <ConfigurePage onAnalyze={() => setView("results")} />
          </motion.div>
        ) : (
          <motion.div
            key="results"
            className="flex flex-col h-full"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <ResultsPage onBack={() => setView("configure")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
