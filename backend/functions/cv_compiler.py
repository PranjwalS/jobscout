"""
Compiles rendered LaTeX (.tex) source into PDF bytes.

This is the only place that shells out to a LaTeX engine. Callers (endpoints)
should always go: cv_json -> fill_template() -> .tex string -> compile_cv_pdf()
-> pdf bytes. This module knows nothing about cv_json or templates — it just
turns .tex text into a PDF or raises with a useful error.
"""

import os
import subprocess
import tempfile
import shutil
import uuid


class LatexCompileError(RuntimeError):
    """Raised when pdflatex fails. .log holds the relevant tail of the compile log."""
    def __init__(self, message: str, log: str = ""):
        super().__init__(message)
        self.log = log


def compile_cv_pdf(tex_source: str, engine: str = "pdflatex", timeout: int = 30) -> bytes:
    """
    Compiles a .tex source string into PDF bytes using a temp working directory.

    Runs the engine twice (common LaTeX templates need a second pass to resolve
    things like section numbering/spacing — cheap insurance even if the current
    template doesn't strictly need it).

    Raises LatexCompileError with the tail of the .log on failure. Always cleans
    up the temp directory, success or failure.
    """
    if engine not in ("pdflatex", "xelatex"):
        raise ValueError(f"Unsupported engine: {engine}")

    work_dir = tempfile.mkdtemp(prefix="cv_compile_")
    job_name = f"cv_{uuid.uuid4().hex[:8]}"
    tex_path = os.path.join(work_dir, f"{job_name}.tex")
    pdf_path = os.path.join(work_dir, f"{job_name}.pdf")
    log_path = os.path.join(work_dir, f"{job_name}.log")

    try:
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex_source)

        cmd = [
            engine,
            "-interaction=nonstopmode",
            "-halt-on-error",
            f"-jobname={job_name}",
            tex_path,
        ]

        last_result = None
        for _ in range(2):  # two passes
            last_result = subprocess.run(
                cmd,
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            if last_result.returncode != 0:
                break  # no point running pass 2 if pass 1 already failed

        if last_result.returncode != 0 or not os.path.exists(pdf_path):
            log_tail = ""
            if os.path.exists(log_path):
                with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                    log_tail = f.read()[-4000:]  # last ~4000 chars, full log can be huge
            raise LatexCompileError(
                f"{engine} failed with exit code {last_result.returncode}",
                log=log_tail or last_result.stdout[-4000:],
            )

        with open(pdf_path, "rb") as f:
            return f.read()

    except subprocess.TimeoutExpired:
        raise LatexCompileError(f"{engine} timed out after {timeout}s")

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)