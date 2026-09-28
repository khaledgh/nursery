import { ArrowRight, Bell, CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Dict } from "../i18n";
import { DashboardMockup } from "./mockups/DashboardMockup";
import { PhoneMockup } from "./mockups/PhoneMockup";

interface Props {
  t: Pick<Dict, "hero" | "mock">;
  rtl: boolean;
}

/** Mouse-driven offset for one depth layer; deeper layers move less. */
function useDepth(mx: MotionValue<number>, my: MotionValue<number>, strength: number) {
  const x = useTransform(mx, (v) => v * strength);
  const y = useTransform(my, (v) => v * strength);
  return { x, y };
}

const wordVariants = {
  hidden: { opacity: 0, y: 40, rotateX: -60 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: 0.15 + i * 0.07, type: "spring" as const, stiffness: 120, damping: 16 },
  }),
};

function Words({ text, start, className = "" }: { text: string; start: number; className?: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          custom={start + i}
          variants={wordVariants}
          initial="hidden"
          animate="show"
          className={`inline-block will-change-transform ${className}`}
          style={{ transformOrigin: "50% 100%" }}
        >
          {w}&nbsp;
        </motion.span>
      ))}
    </>
  );
}

export default function Hero({ t, rtl }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    setInteractive(!reduce && !window.matchMedia("(pointer: coarse)").matches);
  }, [reduce]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const stageY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const scatter = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 18 });
  const my = useSpring(rawY, { stiffness: 60, damping: 18 });
  const d1 = useDepth(mx, my, 10);
  const d2 = useDepth(mx, my, 22);
  const d3 = useDepth(mx, my, 34);
  const d5 = useDepth(mx, my, 50);
  // Mouse parallax plus a scroll "scatter" so companions drift away from the phone on exit.
  const markX = useTransform(() => d5.x.get() + scatter.get());
  const chipY = useTransform(() => d5.y.get() - scatter.get());

  const onMove = (e: React.MouseEvent) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width - 0.5) * (rtl ? -1 : 1));
    rawY.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <section
      ref={ref}
      id="overview"
      data-eager
      onMouseMove={onMove}
      className="relative isolate overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-32"
    >
      {/* depth-0: atmospheric blobs */}
      <motion.div style={{ y: bgY }} className="pointer-events-none absolute inset-0 -z-20 will-change-transform" aria-hidden="true">
        <div className="glow glow-teal drift absolute -top-32 -start-24 h-[28rem] w-[28rem]" />
        <div className="glow glow-violet drift absolute top-20 -end-32 h-[32rem] w-[32rem] [animation-delay:-5s]" />
        <div className="glow glow-marigold drift absolute bottom-0 start-1/3 h-72 w-72 [animation-delay:-9s]" />
      </motion.div>

      {/* depth-1: dotted grid glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(#6c5ce7_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
        aria-hidden="true"
      />

      {/* depth-2: logo motifs drifting */}
      <motion.div style={d2} className="pointer-events-none absolute inset-0 -z-10 will-change-transform" aria-hidden="true">
        <span className="float-loop absolute top-32 start-[6%] text-4xl text-marigold">★</span>
        <span className="float-loop-slow absolute top-[60%] start-[3%] h-4 w-4 rounded-full bg-coral" />
        <span className="float-loop absolute top-[22%] start-[46%] h-3 w-3 rounded-full bg-sky [animation-delay:-3s]" />
        <span className="float-loop-slow absolute bottom-16 end-[8%] text-5xl font-black text-marigold">+</span>
        <svg className="float-loop absolute top-[38%] end-[4%] h-10 w-10 text-violet/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </motion.div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        {/* depth-4: text */}
        <motion.div style={reduce ? undefined : { y: textY, opacity: textOpacity }} className="relative z-10 text-center lg:text-start">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="eyebrow"
          >
            <Sparkles size={14} /> {t.hero.badge}
          </motion.span>

          <h1 className="mt-6 text-4xl leading-[1.08] font-black tracking-tight text-ink [perspective:800px] sm:text-5xl lg:text-6xl">
            <Words text={t.hero.titleA} start={0} />
            <br className="hidden sm:block" />
            <Words text={t.hero.titleHighlight} start={t.hero.titleA.split(" ").length} className="text-gradient" />
            <br className="hidden sm:block" />
            <Words
              text={t.hero.titleB}
              start={(t.hero.titleA + " " + t.hero.titleHighlight).split(" ").length}
              className="text-ink/80"
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.6 }}
            className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
          >
            <button type="button" data-demo className="btn-primary text-base">
              {t.hero.ctaDemo}
              <ArrowRight size={18} className="rtl:rotate-180" />
            </button>
            <a href="#features" className="btn-ghost text-base">
              {t.hero.ctaFeatures}
            </a>
          </motion.div>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 1.2 } } }}
            className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-ink/70 lg:justify-start"
          >
            {t.hero.trust.map((item) => (
              <motion.li
                key={item}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} className="text-teal" /> {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* depth-3: product stage */}
        <motion.div
          style={reduce ? undefined : { y: stageY, scale: stageScale }}
          className="relative mx-auto h-[520px] w-full max-w-[560px] sm:h-[560px]"
        >
          <motion.div style={d1} className="absolute top-6 end-0 hidden will-change-transform sm:block">
            <motion.div
              initial={{ opacity: 0, x: rtl ? -60 : 60, rotate: rtl ? -4 : 4 }}
              animate={{ opacity: 1, x: 0, rotate: rtl ? -3 : 3 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 70, damping: 16 }}
            >
              <DashboardMockup t={t.mock} className="origin-top-right scale-[0.92]" />
            </motion.div>
          </motion.div>

          <motion.div style={d3} className="absolute bottom-0 z-10 will-change-transform start-1/2 -translate-x-1/2 rtl:translate-x-1/2 sm:start-[4%] sm:translate-x-0 sm:rtl:translate-x-0">
            <motion.div
              initial={{ opacity: 0, y: 120 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 60, damping: 14 }}
            >
              <div className="float-soft">
                <PhoneMockup t={t.mock} />
              </div>
            </motion.div>
          </motion.div>

          {/* The N+ mark, orbiting the phone */}
          <motion.div style={{ x: markX, y: d5.y }} className="absolute top-[6%] start-[60%] z-20 will-change-transform sm:top-[18%] sm:-start-[16%] sm:z-0">
            <motion.img
              src="/mark.webp"
              alt="Nursee+"
              width={150}
              height={165}
              initial={{ opacity: 0, scale: 0.3, rotate: -25 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 140, damping: 10 }}
              className="w-28 drop-shadow-[0_20px_30px_rgba(108,92,231,0.35)] sm:w-36"
            />
          </motion.div>

          {/* Floating notification chips (depth-5) */}
          <motion.div style={{ x: d5.x, y: chipY }} className="absolute top-[42%] end-[2%] z-30 will-change-transform">
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.3, type: "spring", stiffness: 180, damping: 14 }}
            >
              <div className="float-soft flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 [animation-delay:-2s]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-light text-violet">
                  <MessageCircle size={16} />
                </span>
                <div className="text-start">
                  <div className="text-[11px] font-extrabold text-ink">{t.mock.teacherName}</div>
                  <div className="text-[10px] font-semibold text-muted">{t.mock.teacherMsg}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div style={d2} className="absolute bottom-10 end-[8%] z-30 will-change-transform">
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5, type: "spring", stiffness: 180, damping: 14 }}
            >
              <div className="float-soft flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 [animation-delay:-5s]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-light text-teal">
                  <Bell size={16} />
                </span>
                <span className="text-[11px] font-extrabold text-ink">{t.mock.checkedIn}</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
