'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  LockKeyhole,
  Mic,
  MonitorUp,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  analyzeScreen,
  evaluateSession,
  generateClientSideNLPQuestion,
  generateLocalQuestion,
  loadLocalInterviewer,
  type LocalEvaluationReport,
  type QAItem,
} from '@/lib/local-ai'

type TranscriptItem = { speaker: string; text: string }

export function VivaAIApp() {
  const [screen, setScreen] = useState<'setup' | 'studio' | 'report'>('setup')
  const [name, setName] = useState('Alex Rivera')
  const [project, setProject] = useState('VivaAI — Browser AI Examiner')
  const [stack, setStack] = useState('Next.js, React, Tailwind CSS, WebGPU, Tesseract.js')
  
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questions, setQuestions] = useState<string[]>([])
  const [qaHistory, setQaHistory] = useState<QAItem[]>([])

  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [modelProgress, setModelProgress] = useState(0)
  const [ocrText, setOcrText] = useState('')
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isMicOn, setIsMicOn] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [liveAnswer, setLiveAnswer] = useState('')
  const [liveTranscript, setLiveTranscript] = useState<TranscriptItem[]>([])
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const recognitionRef = useRef<any>(null)

  const stopAllStreams = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch (e) {}
      mediaStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
      recognitionRef.current = null
    }
    setIsMicOn(false)
    setIsCapturing(false)
  }

  // Ensure persistent video element binding when stream is active
  useEffect(() => {
    if (isCapturing && mediaStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [isCapturing, screen])

  const startInterview = async () => {
    if (!name.trim() || !project.trim() || !stack.trim()) return
    setIsStarting(true)

    // Generate Question 1 INSTANTLY with zero loading delay!
    const initialQuestion = generateClientSideNLPQuestion({
      project,
      stack,
      ocrText: '',
      transcript: '',
      previousQuestions: [],
      qaHistory: [],
    })

    setQuestions([initialQuestion])
    setScreen('studio')
    setIsStarting(false)

    // Auto-enable microphone for Question 1!
    setTimeout(() => {
      toggleMicrophone()
    }, 400)
  }

  const currentQuestion = useMemo(() => questions[questionIndex] ?? '', [questions, questionIndex])

  const persistEvent = (eventType: string, payload: Record<string, unknown> = {}) => {
    try {
      const request = indexedDB.open('vivaai-local', 1)
      request.onsuccess = () => {
        const db = request.result
        if (db.objectStoreNames.contains('events')) {
          const transaction = db.transaction('events', 'readwrite')
          transaction.objectStore('events').add({
            id: crypto.randomUUID(),
            sessionId: 'local-session',
            eventType,
            payload,
            createdAt: new Date().toISOString(),
          })
        }
      }
    } catch (e) {}
  }

  const beginScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      mediaStreamRef.current = stream
      setIsCapturing(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      
      setIsOcrProcessing(true)
      if (videoRef.current) {
        const extractedText = await analyzeScreen(videoRef.current)
        if (extractedText) setOcrText(extractedText)
        persistEvent('ocr_completed', { text: extractedText })
      }
      setIsOcrProcessing(false)

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setIsCapturing(false)
        mediaStreamRef.current = null
        persistEvent('screen_share_ended')
      })
      void persistEvent('screen_share_started')
    } catch (error) {
      setIsOcrProcessing(false)
    }
  }

  const triggerManualOcr = async () => {
    if (!videoRef.current || !isCapturing) return
    setIsOcrProcessing(true)
    const text = await analyzeScreen(videoRef.current)
    if (text) setOcrText(text)
    setIsOcrProcessing(false)
  }

  const isMicOnRef = useRef(false)

  const toggleMicrophone = () => {
    if (isMicOn) {
      isMicOnRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {}
        recognitionRef.current = null
      }
      setIsMicOn(false)
      void persistEvent('microphone_stopped')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setLiveAnswer(text)
      setLiveTranscript((items) => [
        ...items.filter((item) => !item.speaker.includes('live')),
        { speaker: 'You (live)', text },
      ])
    }

    recognition.onend = () => {
      if (isMicOnRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (e) {}
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[VivaAI] speech info:', event.error)
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      isMicOnRef.current = true
      setIsMicOn(true)
      void persistEvent('microphone_started')
    } catch (err) {
      isMicOnRef.current = false
      setIsMicOn(false)
    }
  }

  const advanceQuestion = async () => {
    const answer = liveAnswer.trim() || 'No verbal or typed answer provided for this question.'
    setIsThinking(true)

    // Save Q&A Item for this question
    const currentQA: QAItem = {
      questionIndex: questionIndex + 1,
      question: currentQuestion,
      answer,
      ocrSnapshot: ocrText,
    }

    const updatedQaHistory = [...qaHistory, currentQA]
    setQaHistory(updatedQaHistory)

    const updatedTranscript = [
      ...liveTranscript.filter((item) => item.speaker !== 'You (live)'),
      { speaker: `You (Q${questionIndex + 1})`, text: answer },
    ]

    persistEvent('answer_submitted', { answer, questionIndex })

    if (questionIndex + 1 >= 3) {
      // 3 Questions Completed -> Completely stop screen share & mic permissions!
      stopAllStreams()
      setLiveTranscript(updatedTranscript)
      setIsThinking(false)
      persistEvent('session_completed', { qaHistory: updatedQaHistory })
      setScreen('report')
      return
    }

    // Generate Next Question (Dynamic stack question)
    const nextQuestion = generateClientSideNLPQuestion({
      project,
      stack,
      ocrText,
      transcript: updatedTranscript.map((item) => `${item.speaker}: ${item.text}`).join('\n'),
      previousQuestions: questions,
      qaHistory: updatedQaHistory,
    })

    const finalTranscript = [...updatedTranscript, { speaker: 'VivaAI', text: nextQuestion }]
    setLiveTranscript(finalTranscript)
    setQuestions((items) => [...items, nextQuestion])
    setQuestionIndex((prev) => prev + 1)
    setLiveAnswer('')
    setIsThinking(false)
  }

  const endSessionEarly = () => {
    stopAllStreams()
    setScreen('setup')
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="no-print mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <button className="flex items-center gap-3" onClick={() => setScreen('setup')} aria-label="Return to VivaAI home">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BrainCircuit className="size-5" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">
            viva<span className="text-primary/60">ai</span>
          </span>
        </button>
        <div className="hidden items-center gap-6 text-xs font-medium text-muted-foreground sm:flex">
          <span className="flex items-center gap-2">
            <LockKeyhole className="size-3.5" /> 100% Client-Side Engine
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-3.5" /> Zero Server API Keys
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" /> Live local mode
        </div>
      </header>

      {screen === 'setup' && (
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-20">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Real-Time Automated Project Examiner
            </div>
            <h1 className="text-balance font-mono text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl">
              Practice your project. <span className="text-muted-foreground">Master your viva.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              VivaAI is a private, client-side interviewer that reads your presentation slides via OCR, listens to your voice speech, and asks questions tailored specifically to your tech stack.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Zero Server API Keys
              </span>
              <span className="flex items-center gap-2">
                <WandSparkles className="size-4 text-primary" /> Tech Stack-Targeted Questions
              </span>
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Printable PDF Reports
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-[0_20px_70px_-35px_var(--foreground)] sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Session setup</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Configure Your Viva</h2>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <MonitorUp className="size-5 text-primary" />
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Student / Presenter Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="h-11 rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Project Title
                <input
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="e.g. VivaAI — Browser Automated Interviewer"
                  className="h-11 rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Tech Stack & Architecture (Questions target these exact technologies!)
                <input
                  value={stack}
                  onChange={(e) => setStack(e.target.value)}
                  placeholder="e.g. React, Next.js, Python, PostgreSQL, OpenCV, WebGPU"
                  className="h-11 rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </label>
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-muted p-4 text-xs leading-5 text-muted-foreground">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                100% Client-Side Privacy: Video frames, screen audio, speech transcription, and LLM inference run strictly inside your local browser instance.
              </span>
            </div>
            <Button className="mt-6 h-12 w-full rounded-xl" onClick={startInterview} disabled={isStarting}>
              {isStarting ? 'Loading browser engine…' : 'Start Live Viva Studio'} <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      )}

      {screen === 'studio' && (
        <section className="mx-auto max-w-7xl px-5 pb-10 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Live interview · Question {questionIndex + 1} of 3
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{project}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Presenter: <span className="font-medium text-foreground">{name}</span> | Target Stack:{' '}
                <span className="font-medium text-primary">{stack}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" /> Real-time Execution
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
            {/* Left Box: Screen Share & OCR Display */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MonitorUp className="size-4 text-primary" /> Screen Share & Presentation OCR
                </div>
                <div className="flex items-center gap-2">
                  {isCapturing && (
                    <button
                      onClick={triggerManualOcr}
                      disabled={isOcrProcessing}
                      className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
                    >
                      {isOcrProcessing ? 'Scanning Slide OCR...' : 'Scan Slide Text'}
                    </button>
                  )}
                  <button
                    onClick={beginScreenShare}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                      isCapturing ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${isCapturing ? 'bg-primary' : 'bg-primary-foreground'}`} />
                    {isCapturing ? 'Screen Connected' : 'Share Presentation Screen'}
                  </button>
                </div>
              </div>

              {/* Framed Video Container (ALWAYS Mounted!) */}
              <div className="relative flex flex-col justify-between rounded-3xl border border-border bg-card p-5 min-h-[380px] overflow-hidden">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-border bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-contain ${isCapturing ? 'block' : 'hidden'}`}
                  />
                  {!isCapturing && (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-white/80">
                      <MonitorUp className="size-10 text-primary mb-2" />
                      <p className="font-semibold text-sm">Presentation Screen Inactive</p>
                      <p className="text-xs text-white/50 mt-1 max-w-xs">
                        Click &quot;Share Presentation Screen&quot; to stream your slides or code editor.
                      </p>
                    </div>
                  )}
                  {isCapturing && (
                    <span className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 font-mono text-[10px] text-white">
                      LIVE SCREEN CAPTURE
                    </span>
                  )}
                </div>

                {/* Clean OCR Context Output below video */}
                <div className="mt-4 rounded-2xl bg-muted/60 p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Extracted Slide & Code OCR Context:
                    </span>
                    {isOcrProcessing && <span className="text-xs text-primary font-medium animate-pulse">OCR Active...</span>}
                  </div>
                  <p className="mt-2 font-mono text-xs leading-5 text-foreground max-h-24 overflow-y-auto pr-1">
                    {ocrText || (isCapturing ? 'Click "Scan Slide Text" to extract code snippets and text from your current screen.' : 'No screen text captured yet.')}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Mic className="size-4 text-primary" /> Speech Input: {isMicOn ? 'Listening to voice...' : 'Mic Ready'}
                  </div>
                  <button
                    onClick={toggleMicrophone}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isMicOn ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {isMicOn ? <Volume2 className="size-4" /> : <Mic className="size-4" />}
                    {isMicOn ? 'Microphone Active' : 'Enable Speech Input'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Box: Tech-Targeted Question Card & Live Transcript */}
            <div className="flex flex-col gap-4">
              <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    <CircleHelp className="size-4" /> Question {questionIndex + 1} of 3
                  </span>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    STACK TAILORED
                  </span>
                </div>
                <p className="mt-4 text-xl font-medium leading-8 tracking-tight text-foreground">
                  {currentQuestion ||
                    (modelStatus === 'loading'
                      ? `Initializing browser engine… ${Math.round(modelProgress * 100)}%`
                      : 'Analyzing presentation slides and speech transcript...')}
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" /> Questions adapt dynamically to your stack ({stack.split(',')[0]})
                </div>
              </div>

              <div className="flex flex-1 flex-col rounded-3xl border border-border bg-card p-5 min-h-[260px]">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Live Answer Input for Question {questionIndex + 1}
                  </p>
                  <span className="text-xs text-primary font-medium">{isMicOn ? 'Listening...' : 'Type or Speak Answer'}</span>
                </div>

                <div className="mt-4 flex flex-col gap-3 flex-1 max-h-[180px] overflow-y-auto pr-1 text-sm leading-6">
                  {liveTranscript.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">Your spoken or typed response for Question {questionIndex + 1} will appear here...</p>
                  ) : (
                    liveTranscript.map((item, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {item.speaker}
                        </span>
                        <span className={item.speaker === 'VivaAI' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                          {item.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border">
                  <input
                    value={liveAnswer}
                    onChange={(e) => setLiveAnswer(e.target.value)}
                    placeholder={`Type or speak your answer for Question ${questionIndex + 1} here...`}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={endSessionEarly}>
                  <X data-icon="inline-start" /> End Session
                </Button>
                <Button className="h-11 flex-1 rounded-xl" onClick={advanceQuestion} disabled={isThinking}>
                  {isThinking ? 'Evaluating...' : 'Submit & Next Question'} <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === 'report' && (
        <ReportScreen
          name={name}
          project={project}
          stack={stack}
          ocrText={ocrText}
          qaHistory={qaHistory}
          onRestart={() => {
            setQuestionIndex(0)
            setQuestions([])
            setQaHistory([])
            setLiveTranscript([])
            setOcrText('')
            setScreen('setup')
          }}
        />
      )}
    </main>
  )
}

function ReportScreen({
  name,
  project,
  stack,
  ocrText,
  qaHistory,
  onRestart,
}: {
  name: string
  project: string
  stack: string
  ocrText: string
  qaHistory: QAItem[]
  onRestart: () => void
}) {
  const report: LocalEvaluationReport = useMemo(() => {
    return evaluateSession(project, stack, ocrText, qaHistory)
  }, [project, stack, ocrText, qaHistory])

  const triggerPDFDownload = () => {
    window.print()
  }

  const exportReportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ project, name, stack, report, qaHistory }, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `${project.toLowerCase().replace(/\s+/g, '-')}-viva-report.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  return (
    <section className="mx-auto max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <Check className="size-3.5" /> Full 3-Question Viva Evaluation Complete
          </div>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Your Viva Performance Report</h1>
          <p className="mt-3 text-muted-foreground">
            Real-time evaluation for <span className="font-medium text-foreground">{project}</span> presented by{' '}
            <span className="font-medium text-foreground">{name}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-3">
          <Button className="rounded-xl bg-primary text-primary-foreground" onClick={triggerPDFDownload}>
            <Printer className="mr-2 size-4" /> Download PDF Report
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={exportReportJSON}>
            <Download className="mr-2 size-4" /> Export JSON
          </Button>
          <Button variant="ghost" className="rounded-xl" onClick={onRestart}>
            <RotateCcw className="mr-2 size-4" /> Practice Again
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-4">
        <Score label="Overall Score" value={String(report.overallScore)} note="Evaluated across all 3 viva questions" />
        <Score label="Technical Depth" value={String(report.technicalDepth.score)} note={report.technicalDepth.note} />
        <Score label="Clarity" value={String(report.clarity.score)} note={report.clarity.note} />
        <Score label="Implementation" value={String(report.understanding.score)} note={report.understanding.note} />
      </div>

      {/* Per-Question Detailed Assessment Breakdown */}
      <div className="mt-8 rounded-3xl border border-border bg-card p-6">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Question-by-Question Evaluation Breakdown
        </p>
        <div className="mt-4 flex flex-col gap-6">
          {report.qaAssessments.map((qa) => (
            <div key={qa.questionNumber} className="rounded-2xl bg-muted/50 p-5 border border-border">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-primary uppercase tracking-wider">
                  Question {qa.questionNumber}
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                  {qa.score} / 100
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{qa.question}</p>
              <div className="mt-3 rounded-xl bg-background p-3 text-xs leading-5 text-muted-foreground border border-border">
                <span className="font-semibold text-foreground">Your Answer: </span>
                {qa.studentAnswer}
              </div>
              <p className="mt-2 text-xs font-medium text-primary">
                Examiner Assessment: {qa.feedback}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Examiner Synthesis</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Performance Summary</h2>
          <p className="mt-4 leading-7 text-muted-foreground">{report.summaryText}</p>

          <div className="mt-6 rounded-2xl bg-muted p-4 border border-border">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Technical Terms Identified:</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {report.keyKeywordsFound.length > 0 ? (
                report.keyKeywordsFound.map((kw, idx) => (
                  <span key={idx} className="rounded-md bg-background px-2.5 py-1 text-xs font-medium text-primary border border-border">
                    {kw}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No specific stack keywords detected in short transcript</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detailed Feedback</p>
          
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Key Strengths
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {report.strengths.map((s, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold">•</span> {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Actionable Recommendations
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {report.improvements.map((imp, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold">•</span> {imp}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Score({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end gap-1">
        <span className="font-mono text-4xl font-semibold tracking-[-0.08em]">{value}</span>
        <span className="mb-1 text-sm text-muted-foreground">/100</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{note}</p>
    </div>
  )
}
