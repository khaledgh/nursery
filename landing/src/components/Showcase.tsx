import { Check } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import type { Dict } from "../i18n";
import { DashboardMockup } from "./mockups/DashboardMockup";
import { PhoneMockup } from "./mockups/PhoneMockup";
import { Reveal } from "./Reveal";

interface Props {
  t: Dict["showcase"];
  mock: Dict["mock"];
}

const accents = ["#2cafa8", "#6c5ce7", "#ff5e7e"];

function Device({ index, mock }: { index: number; mock: Dict["mock"] }) {
  if (index === 2) return <DashboardMockup t={mock} className="max-w-full" />;
  return <PhoneMockup t={mock} variant={index === 0 ? "parent" : "teacher"} />;
}

export default function Showcase({ t, mock }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // scaleY instead of height: transforms skip layout entirely.
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(t.steps.length - 1, Math.floor(v * t.steps.length));
    if (next !== active) setActive(next);
  });

  return (
    <section id="apps" className="relative bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-24 text-center sm:px-6">
        <Reveal>
          <span className="eyebrow">{t.eyebrow}</span>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black text-ink sm:text-5xl">{t.title}</h2>
        </Reveal>
      </div>

      {/* Desktop: pinned stage driven by scroll */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${t.steps.length * 90}vh` }}>
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-center gap-16 px-6">
            <div className="relative space-y-4">
              <div className="absolute inset-y-0 -start-6 w-1 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full w-full origin-top rounded-full bg-gradient-to-b from-teal via-violet to-coral will-change-transform"
                  style={{ scaleY: progress }}
                />
              </div>
              {t.steps.map((step, i) => (
                <motion.div
                  key={step.tag}
                  animate={{ opacity: i === active ? 1 : 0.35, scale: i === active ? 1 : 0.97 }}
                  transition={{ duration: 0.4 }}
                  className={`rounded-3xl p-6 transition-colors ${i === active ? "bg-cream shadow-lg ring-1 ring-black/5" : ""}`}
                >
                  <span
                    className="inline-block rounded-full px-3 py-1 text-xs font-extrabold text-white"
                    style={{ background: accents[i] }}
                  >
                    {step.tag}
                  </span>
                  <h3 className="mt-3 text-2xl font-black text-ink">{step.title}</h3>
                  <AnimatePresence initial={false}>
                    {i === active && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-2 text-muted">{step.desc}</p>
                        <ul className="mt-4 space-y-2">
                          {step.points.map((p) => (
                            <li key={p} className="flex items-center gap-2 font-bold text-ink/80">
                              <span className="grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: accents[i] }}>
                                <Check size={12} strokeWidth={3} />
                              </span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <div className="relative grid h-[560px] place-items-center">
{accents.map((c, i) => (
                <motion.div
                  key={c}
                  className="glow absolute h-[520px] w-[520px]"
                  style={{ ["--glow-color" as string]: `${c}55` }}
                  animate={{ opacity: i === active ? 1 : 0 }}
                  transition={{ duration: 0.6 }}
                  aria-hidden="true"
                />
              ))}
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 60, rotate: -6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -60, rotate: 6, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 90, damping: 16 }}
                  className="relative"
                >
                  <Device index={active} mock={mock} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet: stacked cards */}
      <div className="mx-auto max-w-xl space-y-16 px-4 py-16 lg:hidden">
        {t.steps.map((step, i) => (
          <Reveal key={step.tag} className="text-center">
            <span className="inline-block rounded-full px-3 py-1 text-xs font-extrabold text-white" style={{ background: accents[i] }}>
              {step.tag}
            </span>
            <h3 className="mt-3 text-2xl font-black text-ink">{step.title}</h3>
            <p className="mt-2 text-muted">{step.desc}</p>
            <div className={`mt-8 flex justify-center text-start ${i === 2 ? "h-[300px] overflow-hidden sm:h-auto" : ""}`}>
              <div className={i === 2 ? "origin-top scale-[0.8] sm:scale-100" : ""}>
                <Device index={i} mock={mock} />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
