import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ConfigurePage } from "./pages/ConfigurePage";
import { ResultsPage }   from "./pages/ResultsPage";
import { LoadingScreen } from "./components/LoadingScreen";
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
  // Animate the results cards only when the user navigates here intentionally.
  // On a shared-link refresh we restore straight into results, so skip the fade.
  const [animateResults, setAnimateResults] = useState(true);
  // Boot splash shown while the app mounts and the catalogs are prepared.
  const [booting, setBooting] = useState(true);

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

    if (gpu && cpu && game) {
      setAnimateResults(false); // restored from a shared link → appear instantly, no fade
      setView("results");
    }
  }, []);

  // Dismiss the boot splash once the first frame has painted and the
  // catalogs are ready. A short minimum keeps it from flashing.
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex flex-col h-full bg-surface-900 overflow-hidden">
      <AnimatePresence>
        {booting && <LoadingScreen key="boot" />}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {view === "configure" ? (
          <motion.div
            key="configure"
            className="flex flex-col h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <ConfigurePage onAnalyze={() => { setAnimateResults(true); setView("results"); }} />
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
            <ResultsPage onBack={() => setView("configure")} animateEntrance={animateResults} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
