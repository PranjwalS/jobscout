# curr_tasks.md
> JobScout + CareerTwin — Task Pipeline

---

Last update on : 17-05-2026



CURRENT NOTES;



backend pseudo → code + test → frontend refinement (grids, filtering, search) → add endpoints as needed → then LLM mock interview + auto-apply extension AND finally auto-apply bot BEFORE EXPANDING
the extension (Apply AI) you already have architecture for so that's just finishing it
one thing — don't forget the subscription/paywall layer before you call it MVP launch. that's the monetization piece and it needs to exist before you go public, even if it's just Stripe basic







## 🗄️ Backend & Data Layer

- [x] `schemas.md` — finalize all data schemas
- [x] `models.py` — define all ORM / pydantic models
- [x] Make entities on Supabase — create tables, relationships, RLS policies
- [ ] Setup scraper pipeline in `scraper.py`
- [ ] Populate `jobs` table via scraper
- [ ] Populate `user_jobs` from jobs

---

## 🤖 Scoring & Generation Logic

- [ ] Generalize `scoring.py` — CV → LLM direction
- [ ] Create LLM → CV scoring direction (reverse flow)
- [ ] Create prompt for LLM scoring
- [ ] Generalize `coverletter_generation.py`
- [ ] Generalize `cv_generation.py`

---

## 📄 CV & Cover Letter Tooling

- [ ] Setup LaTeX compiler
- [ ] Make visual editor for CV and cover letter

---

## 🖥️ Frontend — Core Setup

- [ ] Create new frontend — Jira-style layout with sidebar
- [ ] Setup login logic with new backend
- [ ] Setup dashboard creation logic in backend
- [ ] Setup login forms in frontend
- [ ] Setup dashboard creation forms in frontend
- [ ] Test the full auth + dashboard creation flow

---

## 📊 Dashboard — Views & Grids

- [ ] Redesign tabs for dashboard view (4 tabs):
  - [ ] All Jobs
  - [ ] Queued Jobs (auto-apply)
  - [ ] Applied Jobs
  - [ ] Final Step Jobs
- [ ] Build all grids for the 4 tabs
- [ ] Build job page template design in frontend

---

## 🔗 Integration & Wiring

- [ ] Connect scoring, CV, and resume logic to dashboard frontend
- [ ] Make dashboard fully functional end-to-end

---

## ✨ Refinement & UX

- [ ] Refine heavily — make it as simple to use as possible
- [ ] Add searching and filtering in the frontend
- [ ] Properly test the full flow
- [ ] Send email notifications with action buttons

---

## 🌐 CareerTwin Improvements

- [ ] Improve CareerTwin with GitHub connection and data
- [ ] Improve auto-apply extension abilities

---

## 🎤 Interview Prep

- [ ] Implement interview preparation scaffolding
- [ ] Build mock interview flows

---

## 🧰 Standalone Mini-Products (Sidebar Tabs)

- [ ] Manual cover letter generator (from job description)
- [ ] Manual CV generator / modifier (from job description)
- [ ] Auto CV-to-job scorer
- [ ] Other standalone tools as needed

---

## 🗂️ Dashboard Management

- [ ] Manual job addition to tables
- [ ] Dashboard deletion flows

---

## 📋 Logs & Automation

- [ ] Create proper Logs tab
- [ ] Build auto-applying bot (Playwright + LLM) — integrates with `queued_jobs` per user efficiently

---

## 🧠 RAG & LLM Assistant

- [ ] Implement RAG + LLM assistant in CareerTwin
- [ ] Integrate as a site-wide chatbot for:
  - [ ] Career advice (future projects, education, certification ideas)
  - [ ] Job comparison with future prospects between 2+ jobs
  - [ ] General CareerTwin "digital twin" aspect
  - [ ] Different LLM chatbot for JobScout where you ask question regarding specific jobs so basically two chatbots (careertwina and jobscout)

---

## 🚀 Final Phase

- [ ] Refine and test everything
- [ ] Document the full system
- [ ] Present and prepare for expansion