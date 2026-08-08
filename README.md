# VivaAI — Browser-Based Automated Project Examiner

> **100% Client-Side | Zero API Keys | WebGPU Local AI Inference | Local Screen OCR & Speech-to-Text**

VivaAI is an autonomous, browser-native AI system that listens to a student presenting a project (via screen share + speech) and conducts an adaptive viva interview based on live slide content and spoken responses—**completely client-side without using any external server API keys**.

---

## 🚀 Key Features

- **Local AI Question Generator**: Powered by `@mlc-ai/web-llm` running local 4-bit quantized LLMs over WebGPU, with a seamless client-side NLP engine fallback.
- **Client-Side Screen OCR**: Captures active slides, architectural diagrams, and code snippets via `Tesseract.js` inside a WebAssembly (WASM) Web Worker.
- **Real-Time Speech-to-Text**: Transcribes student speech using browser Web Speech API & HuggingFace Transformers.js Whisper.
- **Dynamic Evaluation Engine**: Computes real-time dynamic scores for **Technical Depth**, **Clarity of Explanation**, **Originality**, and **Implementation Understanding** based strictly on the student's actual presentation content.
- **Full Privacy & Offline Persistence**: All session data stays inside browser `IndexedDB` (`vivaai-local`). No data is ever transmitted to remote servers.

---

## 📁 Full Project Documentation Suite

Comprehensive documentation for interviews, technical deep-dives, architecture, setup, data model, and privacy is available in the [`docs/`](file:///c:/Users/ANIKET/Downloads/viva-ai/docs) directory:

- 📄 **[Architecture Guide](file:///c:/Users/ANIKET/Downloads/viva-ai/docs/ARCHITECTURE.md)**: WebGPU inference, Tesseract OCR, WebSpeech API, IndexedDB pipeline.
- 📄 **[Setup & Environment Guide](file:///c:/Users/ANIKET/Downloads/viva-ai/docs/SETUP_AND_ENV.md)**: Browser flags, installation, `.env` explanations.
- 📄 **[Data Model Specification](file:///c:/Users/ANIKET/Downloads/viva-ai/docs/DATA_MODEL.md)**: IndexedDB schema & JSON report export structure.
- 📄 **[Interview & Tricky Q&A Guide](file:///c:/Users/ANIKET/Downloads/viva-ai/docs/INTERVIEW_QUESTIONS_AND_ANSWERS.md)**: Comprehensive viva questions, WebGPU VRAM management, WASM memory, and impressive answers for interviewers.
- 📄 **[Privacy & Security Model](file:///c:/Users/ANIKET/Downloads/viva-ai/docs/PRIVACY_AND_SECURITY.md)**: Zero-telemetry policy and local stream isolation.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a WebGPU-enabled browser (Chrome/Edge v113+ recommended).
