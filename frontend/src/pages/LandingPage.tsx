import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

function FlowSection({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <section
      data-flow-section
      className={`relative min-h-screen w-full overflow-hidden ${className}`}
    >
      <div
        className="flow-art-container relative flex min-h-screen w-full flex-col justify-between gap-6 px-[4vw] pt-[clamp(2rem,8vw,4rem)] pb-[4vw] will-change-transform"
        style={{ transformOrigin: "bottom left", ...style }}
      >
        {children}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const containerRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current || reducedMotion) return;
      const sections = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>("[data-flow-section]")
      );
      if (!sections.length) return;
      const triggers: ScrollTrigger[] = [];

      sections.forEach((section, i) => {
        gsap.set(section, { zIndex: i + 1 });
        const inner = section.querySelector<HTMLElement>(".flow-art-container");
        if (!inner) return;

        if (i > 0) {
          gsap.set(inner, { rotation: 30, transformOrigin: "bottom left" });
          const tween = gsap.to(inner, {
            rotation: 0,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "top 25%",
              scrub: true,
            },
          });
          if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
        }

        if (i < sections.length - 1) {
          triggers.push(
            ScrollTrigger.create({
              trigger: section,
              start: "bottom bottom",
              end: "bottom top",
              pin: true,
              pinSpacing: false,
            })
          );
        }
      });

      ScrollTrigger.refresh();
      return () => triggers.forEach((t) => t.kill());
    },
    { scope: containerRef, dependencies: [reducedMotion] }
  );

  return (
    <main ref={containerRef} className="w-full overflow-x-hidden font-['DM_Sans',sans-serif]">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-sm border-b border-zinc-100">
        <span className="text-sm font-bold tracking-widest uppercase text-zinc-900">
          JobScout
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors px-4 py-2"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="text-sm font-medium bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-700 transition-colors"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* ── SECTION 1: Hero ── */}
      <FlowSection style={{ backgroundColor: "#ffffff", color: "#0a0a0a" }}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 mt-8">
          01 — Your career, automated
        </p>
        <hr className="border-zinc-200" />
        <div>
          <h1 className="text-[clamp(3.5rem,11vw,13rem)] font-black leading-[0.88] uppercase tracking-tight text-zinc-900">
            Find.
            <br />
            Apply.
            <br />
            Land.
          </h1>
        </div>
        <hr className="border-zinc-200" />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <p className="max-w-[45ch] text-[clamp(1rem,2vw,1.4rem)] font-normal leading-relaxed text-zinc-600">
            JobScout scrapes thousands of job postings daily, scores them against your profile,
            and generates tailored CVs and cover letters — so you spend time interviewing, not searching.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="shrink-0 bg-zinc-900 text-white text-sm font-semibold px-8 py-4 rounded-md hover:bg-zinc-700 active:scale-95 transition-all"
          >
            Start for free →
          </button>
        </div>
      </FlowSection>

      {/* ── SECTION 2: What it does ── */}
      <FlowSection style={{ backgroundColor: "#0a0a0a", color: "#ffffff" }}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          02 — How it works
        </p>
        <hr className="border-zinc-800" />
        <div>
          <h2 className="text-[clamp(3.5rem,11vw,13rem)] font-black leading-[0.88] uppercase tracking-tight">
            Smart.
            <br />
            Fast.
            <br />
            Yours.
          </h2>
        </div>
        <hr className="border-zinc-800" />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: "01 — Create a dashboard", desc: "Set your keywords, location, and target season. JobScout builds a personalized search pipeline from your profile." },
            { label: "02 — Jobs come to you", desc: "Our scraper aggregates LinkedIn, Indeed, and more daily. Every relevant posting is scored against your CV automatically." },
            { label: "03 — Generate & apply", desc: "One click generates a tailored CV and cover letter for each job. Queue them for auto-apply or review manually." },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[200px] flex-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</p>
              <p className="text-[clamp(0.85rem,1.2vw,1rem)] leading-relaxed text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
        <hr className="border-zinc-800" />
        <p className="mt-auto max-w-[50ch] text-[clamp(1rem,2vw,1.4rem)] font-normal leading-relaxed text-zinc-400">
          Stop spending 4 hours a day on job applications. Let JobScout handle the search — you focus on the interviews.
        </p>
      </FlowSection>

      {/* ── SECTION 3: Career Twin ── */}
      <FlowSection style={{ backgroundColor: "#f4f4f0", color: "#0a0a0a" }}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          03 — Career Twin
        </p>
        <hr className="border-zinc-300" />
        <div>
          <h2 className="text-[clamp(3.5rem,11vw,13rem)] font-black leading-[0.88] uppercase tracking-tight">
            Your
            <br />
            Digital
            <br />
            Twin.
          </h2>
        </div>
        <hr className="border-zinc-300" />
        <p className="max-w-[50ch] text-[clamp(1rem,2vw,1.4rem)] font-normal leading-relaxed text-zinc-600">
          Build a living career profile — skills, projects, work history — that powers every CV, every cover letter, every recommendation.
        </p>
        <hr className="border-zinc-300" />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: "Verified projects", desc: "Link GitHub repos and deployed URLs. Your work, proven." },
            { label: "RAG intelligence", desc: "AI recommendations for what to build, learn, and target next." },
            { label: "Public profile", desc: "A shareable page recruiters can actually use." },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider">{label}</p>
              <p className="text-[clamp(0.85rem,1.2vw,1rem)] leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </FlowSection>

      {/* ── SECTION 4: CTA ── */}
      <FlowSection style={{ backgroundColor: "#0a0a0a", color: "#ffffff" }}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          04 — Get started
        </p>
        <hr className="border-zinc-800" />
        <div>
          <h2 className="text-[clamp(3.5rem,11vw,13rem)] font-black leading-[0.88] uppercase tracking-tight">
            Ready?
          </h2>
        </div>
        <hr className="border-zinc-800" />
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-8">
          <p className="max-w-[45ch] text-[clamp(1rem,2vw,1.4rem)] font-normal leading-relaxed text-zinc-400">
            Create your free account. Set up your first dashboard in under 5 minutes. Get matched to jobs by tonight.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={() => navigate("/signup")}
              className="bg-white text-zinc-900 text-sm font-semibold px-8 py-4 rounded-md hover:bg-zinc-200 active:scale-95 transition-all"
            >
              Create account →
            </button>
            <button
              onClick={() => navigate("/login")}
              className="border border-zinc-700 text-white text-sm font-semibold px-8 py-4 rounded-md hover:border-zinc-400 active:scale-95 transition-all"
            >
              Sign in
            </button>
          </div>
        </div>
      </FlowSection>

    </main>
  );
}
