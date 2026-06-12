import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Download, RefreshCw, Save, Loader2, FileText, Printer, Circle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const PAGE_W = 794;
const PAGE_H = 1123;

type State =
  | { stage: "idle" }
  | { stage: "uploading" }
  | { stage: "ready"; userJobId: string; html: string; pdfUrl: string; jobTitle?: string }
  | { stage: "saving"; userJobId: string; html: string; pdfUrl: string; jobTitle?: string }
  | { stage: "regenerating"; userJobId: string; html: string; pdfUrl: string; jobTitle?: string };

export default function CoverLetterPage() {
  const [state, setState] = useState<State>({ stage: "idle" });
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [wordCount, setWordCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem("token");

  // ── Scale A4 to fit canvas ────────────────────────────────────────────────
  const recomputeScale = useCallback(() => {
    if (!canvasRef.current) return;
    const available = canvasRef.current.clientWidth - 48;
    setScale(Math.min(1, available / PAGE_W));
  }, []);

  useEffect(() => {
    recomputeScale();
    const ro = new ResizeObserver(recomputeScale);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [recomputeScale]);

  // ── Write HTML into iframe ────────────────────────────────────────────────
  const writeToIframe = useCallback((html: string, editable: boolean) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    if (!doc.body) return;
    doc.body.setAttribute(
      "style",
      ["outline:none", `opacity:${editable ? "1" : "0.5"}`, `cursor:${editable ? "text" : "default"}`].join(";")
    );
    doc.body.setAttribute("contenteditable", editable ? "true" : "false");
    doc.body.setAttribute("spellcheck", "true");
    const text = doc.body.innerText || "";
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setIsDirty(false);
    if (editable) {
      doc.body.addEventListener("input", () => {
        setIsDirty(true);
        const t = doc.body.innerText || "";
        setWordCount(t.trim().split(/\s+/).filter(Boolean).length);
      });
    }
  }, []);

  // ── Re-render iframe on state change ─────────────────────────────────────
  useEffect(() => {
    if (state.stage === "ready" || state.stage === "saving" || state.stage === "regenerating") {
      writeToIframe(state.html, state.stage === "ready");
    }
  }, [state, writeToIframe]);

  // ── Load cover letter — declared before handleSave so it can reference it ─
  const loadCoverLetter = useCallback(async (userJobId: string, jobTitle?: string) => {
    try {
      const res = await fetch(`${API}/coverletter/get?user_job_id=${userJobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setState({
          stage: "ready",
          userJobId,
          html: data.html_data,
          pdfUrl: `${data.coverletter_url}?t=${Date.now()}`,
          jobTitle,
        });
        setIsDirty(false);
      } else {
        setError("Failed to load cover letter");
        setState({ stage: "idle" });
      }
    } catch {
      setError("Network error loading cover letter");
      setState({ stage: "idle" });
    }
  }, [token]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (state.stage !== "ready") return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument ?? iframe?.contentWindow?.document;
    const html = doc?.documentElement?.outerHTML ?? "";
    if (!html.trim()) { setError("Document is empty — nothing to save"); return; }
    const { userJobId, pdfUrl, jobTitle } = state;
    setState({ stage: "saving", userJobId, html, pdfUrl, jobTitle });
    try {
      const res = await fetch(`${API}/coverletter/edit`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_job_id: userJobId, mode: "html", content: html }),
      });
      if (res.ok) {
        await loadCoverLetter(userJobId, jobTitle);
      } else {
        setError("Save failed");
        await loadCoverLetter(userJobId, jobTitle);
      }
    } catch {
      setError("Save failed — network error");
      await loadCoverLetter(userJobId, jobTitle);
    }
  }, [state, token, loadCoverLetter]);

  // ── Cmd/Ctrl+S ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // ── Upload new job PDF ────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    setState({ stage: "uploading" });
    setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API}/coverletter/new_job`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Failed to generate cover letter");
        setState({ stage: "idle" });
        return;
      }
      const data = await res.json();
      const title = data.job_title ? `${data.job_title}${data.company ? ` @ ${data.company}` : ""}` : undefined;
      await loadCoverLetter(data.user_job_id, title);
    } catch {
      setError("Network error");
      setState({ stage: "idle" });
    }
  };

  // ── Regenerate ────────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (state.stage !== "ready") return;
    const { userJobId, html, pdfUrl, jobTitle } = state;
    setState({ stage: "regenerating", userJobId, html, pdfUrl, jobTitle });
    try {
      const res = await fetch(`${API}/coverletter/edit`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_job_id: userJobId, mode: "regenerate" }),
      });
      if (res.ok) {
        await loadCoverLetter(userJobId, jobTitle);
      } else {
        setError("Regeneration failed");
        await loadCoverLetter(userJobId, jobTitle);
      }
    } catch {
      setError("Regeneration failed — network error");
      await loadCoverLetter(userJobId, jobTitle);
    }
  };

  // ── Auto-download PDF ─────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!pdfUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cover-letter.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // ── Print via iframe ──────────────────────────────────────────────────────
  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const isLoading = state.stage === "uploading" || state.stage === "saving" || state.stage === "regenerating";
  const isReady = state.stage === "ready" || state.stage === "saving" || state.stage === "regenerating";
  const pdfUrl = isReady ? (state as { pdfUrl: string }).pdfUrl : null;
  const jobTitle = isReady ? (state as { jobTitle?: string }).jobTitle : null;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Title */}
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-zinc-900">Cover Letter</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Upload a job posting PDF and we'll generate a tailored cover letter from your profile.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="shrink-0 text-red-500 text-xs font-medium bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Upload zone */}
      {!isReady && (
        <div
          onClick={() => !isLoading && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !isLoading) handleUpload(f); }}
          className="border-2 border-dashed border-zinc-200 rounded-lg p-16 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-all shrink-0"
        >
          {state.stage === "uploading" ? (
            <>
              <Loader2 size={28} className="text-zinc-400 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-700">Parsing & generating cover letter...</p>
                <p className="text-xs text-zinc-400 mt-1">Takes about 10–20 seconds</p>
              </div>
            </>
          ) : (
            <>
              <Upload size={28} className="text-zinc-400" />
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-700">Upload job posting</p>
                <p className="text-xs text-zinc-400 mt-1">PDF only — drag & drop or click</p>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
      )}

      {/* Editor */}
      {isReady && (
        <>
          {/* Toolbar */}
          <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap bg-white border border-zinc-100 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-400 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText size={13} /> New job
              </button>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              {jobTitle && (
                <span className="text-xs text-zinc-400 truncate min-w-0" title={jobTitle}>
                  {jobTitle}
                </span>
              )}
              <span className={`text-xs whitespace-nowrap shrink-0 ${wordCount > 400 ? "text-red-400" : wordCount > 300 ? "text-amber-400" : "text-zinc-400"}`}>
                {wordCount} words · ~{readingTime} min
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-400 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {state.stage === "regenerating" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Regenerate
              </button>

              <button
                onClick={handleSave}
                disabled={isLoading}
                className="relative flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {state.stage === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
                {isDirty && !isLoading && (
                  <Circle size={6} className="absolute -top-1 -right-1 fill-amber-400 text-amber-400" />
                )}
              </button>

              <button
                onClick={handlePrint}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-400 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                <Printer size={13} /> Print
              </button>

              {pdfUrl && !isLoading && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download PDF
                </button>
              )}
            </div>
          </div>

          {/* A4 canvas */}
          <div
            ref={canvasRef}
            className="flex-1 bg-zinc-200 rounded-lg overflow-auto flex justify-center py-8"
            style={{ minHeight: "600px" }}
          >
            <div style={{ width: PAGE_W, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "top center" }}>
              <iframe
                ref={iframeRef}
                title="cover-letter-editor"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  border: "none",
                  display: "block",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                  background: "white",
                }}
              />
            </div>
          </div>

          <p className="shrink-0 text-xs text-zinc-400 text-center">
            Click anywhere in the document to edit · {isDirty ? "Unsaved changes — " : ""}Cmd+S or Save when done
          </p>
        </>
      )}
    </div>
  );
}