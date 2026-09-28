import { Globe, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Dict, Locale } from "../i18n";

interface Props {
  t: Dict["nav"];
  locale: Locale;
  adminUrl: string;
  languages: { code: Locale; name: string; href: string }[];
  /** Locale home ("/", "/ar/") so section links work from sub-pages too. */
  home: string;
}

export default function Navbar({ t, locale, adminUrl, languages, home }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [langOpen]);

  const links = [
    { href: `${home}#overview`, label: t.overview },
    { href: `${home}#features`, label: t.features },
    { href: `${home}#apps`, label: t.apps },
    { href: `${home}#pricing`, label: t.pricing },
    { href: `${home}#contact`, label: t.contact },
  ];

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 shadow-[0_8px_30px_-12px_rgba(30,41,59,0.18)]" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <a href={home} className="flex shrink-0 items-center" aria-label="Nursee+">
          <img src="/logo.webp" alt="Nursee+" width={120} height={112} className="h-14 w-auto sm:h-16" />
        </a>

        <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-4 py-2 text-sm font-bold text-ink/75 transition-colors hover:bg-teal-light hover:text-teal-dark"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <div ref={langRef} className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-label={t.language}
              aria-expanded={langOpen}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-ink/75 hover:bg-white/80"
            >
              <Globe size={17} />
              <span className="uppercase">{locale}</span>
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute end-0 mt-2 w-40 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-black/5"
                >
                  {languages.map((l) => (
                    <li key={l.code}>
                      <a
                        href={l.href}
                        hrefLang={l.code}
                        className={`block rounded-xl px-3 py-2 text-sm font-bold ${
                          l.code === locale ? "bg-teal-light text-teal-dark" : "text-ink/80 hover:bg-slate-50"
                        }`}
                      >
                        {l.name}
                      </a>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <a href={adminUrl} className="hidden rounded-full px-4 py-2 text-sm font-extrabold text-violet hover:bg-violet-light sm:inline-flex">
            {t.login}
          </a>
          <button type="button" data-demo className="btn-primary hidden !px-5 !py-2.5 text-sm sm:inline-flex">
            {t.demo}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t.menu}
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/80 shadow-sm lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-slate-100 bg-white lg:hidden"
          >
            <ul className="space-y-1 px-4 py-4">
              {links.map((l, i) => (
                <motion.li key={l.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2.5 font-bold text-ink hover:bg-teal-light"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
              <li className="flex gap-2 pt-2">
                <a href={adminUrl} className="btn-ghost flex-1 !py-2.5 text-sm">
                  {t.login}
                </a>
                <button type="button" data-demo onClick={() => setOpen(false)} className="btn-primary flex-1 !py-2.5 text-sm">
                  {t.demo}
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
