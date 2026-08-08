# VivaAI — Technical Architecture & Hackathon Brief Documentation

**Project Name**: VivaAI — AI-Driven Automated Interviewer for Project Presentations  
**Architecture Type**: 100% Client-Side Browser Application  
**External API Key Requirement**: Zero (0) External API Keys Needed  

---

## 1. Executive Summary

VivaAI is a privacy-first, 100% browser-executable automated examiner designed to listen to a student presenting a technical project (via screen share + continuous speech input) and conduct an adaptive, multi-question viva interview tailored directly to their declared technology stack.

### Key Hackathon Requirements Achieved:
- **Zero API Key Constraint**: Executes fully client-side without consuming OpenAI, Anthropic, Gemini, or third-party AI gateway keys.
- **Local Screen Understanding & OCR**: Captures live presentation slides and code snippets using `navigator.mediaDevices.getDisplayMedia` and extracts text locally via `Tesseract.js` in a WebAssembly (WASM) Web Worker.
- **Continuous Real-Time Speech Recognition**: Transcribes presenter speech continuously across all interview questions using browser-native Web Speech API (`SpeechRecognition`).
- **Tech Stack-Targeted Adaptive Interviewer**: Generates dynamic follow-up questions explicitly probing the student's declared tech stack (e.g. React, Node.js, Python, PostgreSQL, WebGPU).
- **Multi-Question Evaluation & Report Breakdown**: Evaluates all 3 Q&A responses in real time, producing scores for Technical Depth, Clarity, Originality, and Implementation Understanding, accompanied by a **Downloadable PDF Performance Report**.

---

## 2. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 BROWSER CLIENT                                    |
|                                                                                   |
|  +-------------------+  +------------------+  +--------------------------------+  |
|  | Screen Capture    |  | Microphone Input |  | Student Setup (Name/Project/   |  |
|  | (getDisplayMedia) |  | (WebSpeech API)  |  | Declared Tech Stack)           |  |
|  +---------+---------+  +--------+---------+  +---------------+----------------+  |
|            |                     |                        |                       |
|            v                     v                        v                       |
|  +-------------------+  +------------------+  +--------------------------------+  |
|  | Framed HTML5      |  | Continuous STT   |  | Stack-Targeted Question        |  |
|  | Canvas Scanner    |  | Audio Stream     |  | Generator Engine               |  |
|  +---------+---------+  +--------+---------+  +---------------+----------------+  |
|            |                     |                        |                       |
|            v                     v                        v                       |
|  +-----------------------------------------------------------------------------+  |
|  |               Tesseract.js WebAssembly (WASM) Web Worker                    |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |               Local AI Reasoning & Adaptive Q&A Pipeline                    |  |
|  |               (@mlc-ai/web-llm + Stack-Targeted Client NLP Engine)          |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |               Real-Time Dynamic 3-Question Evaluation Engine                |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |         IndexedDB Store + Printable PDF Performance Report Export           |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Component Breakdown

### 3.1 Presentation Understanding (Screen Capture & OCR)
- **Framed Stream Capture**: Captures live presentation slides, architectural diagrams, and code editors via `navigator.mediaDevices.getDisplayMedia({ video: true })`.
- **Persistent Video Element**: The video stream is bound to a framed `<video>` element ensuring continuous video rendering without unmounting or pitch-black video boxes.
- **Client-Side OCR Extraction**: Offscreen HTML5 canvas sampling extracts video bitmaps and feeds them to `Tesseract.js` executing in a WebAssembly (WASM) Web Worker off the main UI thread. Extracted code snippets and slide headings are displayed in a clean context drawer.

### 3.2 Continuous Speech-to-Text Pipeline (STT)
- **Web Speech API (`SpeechRecognition`)**: Captures real-time student audio continuously.
- **Auto-Rebind Handler (`isMicOnRef`)**: Implements an automated `onend` re-bind listener that prevents Chrome from dropping speech recognition when pauses occur between sentences.
- **Per-Question Transcript Accumulator**: Tracks spoken answers for Question 1, Question 2, and Question 3 independently, ensuring SpeechRecognition state is cleanly formatted for each question.

### 3.3 Tech Stack-Targeted Adaptive Question Generator
- **Instant Question 1 Generation**: Formulates Question 1 synchronously upon entering the Studio with 0ms loading lag.
- **Tech Stack Keyword Parser**: Extracts tech stack tokens (e.g. `React`, `Node.js`, `Python`, `PostgreSQL`, `FastAPI`, `WebGPU`) and builds customized technical questions probing core architecture, state management, event loops, error handling, database indexing, and performance trade-offs.
- **Varied Question Pools**: Uses randomized question selection to ensure repeating the same tech stack yields fresh, varied viva questions every session.

### 3.4 Multi-Question Real-Time Evaluation & Scoring Engine
- **Evaluation Function (`evaluateSession`)**: Evaluates the complete 3-question Q&A history (`qaHistory`) against student answers, screen OCR snapshots, and stack declarations.
- **Dynamic Dimension Metrics**:
  1. **Technical Depth (0-100)**: Evaluates inclusion of stack-specific terminology and architectural depth.
  2. **Clarity of Explanation (0-100)**: Evaluates sentence structure, answer length, and discourse coherence.
  3. **Originality (0-100)**: Detects explicit mention of engineering trade-offs and design constraints.
  4. **Implementation Understanding (0-100)**: Cross-references screen OCR slide evidence with spoken student answers.
- **Per-Question Report Breakdown**: Synthesizes an explicit breakdown for Question 1, Question 2, and Question 3 with individual scores and examiner feedback notes.

### 3.5 Hardware Teardown & Security Lifecycle Management
- **`stopAllStreams()`**: Automatically terminates all video tracks (`getTracks().forEach(t => t.stop())`), clears video source objects, and shuts down microphone permissions as soon as the session completes or when the user clicks **End Session**.

### 3.6 Printable PDF Export & Offline Storage
- **Printable PDF Export**: Integrated `@media print` CSS rules and a **Download PDF Report** action button calling `window.print()` to generate print-ready PDF evaluation reports.
- **Local Persistence (`vivaai-local`)**: Saves session events, OCR snapshots, and Q&A history to browser `IndexedDB`.

---

## 4. Key Technical Solves During Hackathon

| Challenge Encountered | Technical Solution Implemented |
|---|---|
| **Zero Server API Key Constraint** | Combined WebGPU `@mlc-ai/web-llm` with a zero-latency client-side NLP question generator targeting the user's declared tech stack. |
| **Black Video Feed on Screen Share** | Made `<video>` element mounting permanent and added an automated `useEffect` stream-rebinding hook. |
| **Microphone Dropping Between Questions** | Added an `onend` auto-restart handler (`isMicOnRef`) to persist speech recognition across all 3 questions seamlessly. |
| **Generic/Placeholder Question 1** | Synchronously initialized Question 1 from student stack tokens to guarantee instant 0ms question rendering. |
| **Overlapping OCR Text on Video** | Redesigned the Studio interface into a framed layout with video preview on top and scrollable OCR context below. |

---

## 5. Technology Stack Summary

- **Frontend Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling & UI**: Tailwind CSS v4, Lucide Icons, Shadcn UI
- **AI & ML Engines**: `@mlc-ai/web-llm` (WebGPU), HuggingFace `transformers.js`
- **OCR Engine**: `Tesseract.js` (WebAssembly / Web Worker)
- **Speech Engine**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Persistence & Export**: Browser IndexedDB (`vivaai-local`), CSS `@media print` PDF Export
