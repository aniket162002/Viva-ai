'use client'

import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'
import { createWorker } from 'tesseract.js'

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
let enginePromise: Promise<MLCEngine> | null = null
let engineInstance: MLCEngine | null = null

export type QAItem = {
  questionIndex: number
  question: string
  answer: string
  ocrSnapshot: string
}

export type LocalContext = {
  project: string
  stack: string
  ocrText: string
  transcript: string
  previousQuestions: string[]
  qaHistory?: QAItem[]
}

export type QAAssessment = {
  questionNumber: number
  question: string
  studentAnswer: string
  score: number
  feedback: string
}

export type LocalEvaluationReport = {
  overallScore: number
  technicalDepth: { score: number; note: string }
  clarity: { score: number; note: string }
  originality: { score: number; note: string }
  understanding: { score: number; note: string }
  summaryText: string
  strengths: string[]
  improvements: string[]
  keyKeywordsFound: string[]
  qaAssessments: QAAssessment[]
}

export async function loadLocalInterviewer(onProgress?: (value: number) => void) {
  if (engineInstance) return engineInstance
  if (!enginePromise) {
    enginePromise = CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => onProgress?.(report.progress),
    })
      .then((engine) => {
        engineInstance = engine
        return engine
      })
      .catch(() => {
        enginePromise = null
        return null as unknown as MLCEngine
      })
  }
  return enginePromise
}

export async function generateLocalQuestion(context: LocalContext): Promise<string> {
  // Attempt WebLLM model first if available
  try {
    const engine = await loadLocalInterviewer()
    if (engine && typeof engine.chat?.completions?.create === 'function') {
      const response = await engine.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are VivaAI, a rigorous technical examiner. Ask ONE sharp, concise technical question targeting the student tech stack and presentation. Do not repeat previous questions.',
          },
          {
            role: 'user',
            content: `Project: ${context.project}\nTech Stack: ${context.stack}\nScreen OCR: ${context.ocrText || 'None'}\nStudent Previous Answers: ${JSON.stringify(context.qaHistory || [])}\nPrevious Questions: ${context.previousQuestions.join(' | ')}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 120,
      })
      const question = response.choices[0]?.message.content?.trim()
      if (question && question.length > 10) return question
    }
  } catch (err) {
    // Fall back smoothly to local Stack-Driven Question Engine
  }

  // Real-Time Tech Stack & OCR Question Engine
  return generateClientSideNLPQuestion(context)
}

export function generateClientSideNLPQuestion(context: LocalContext): string {
  const { project, stack, ocrText, previousQuestions, qaHistory } = context
  const ocrLower = ocrText.toLowerCase()

  // Parse student's declared tech stack items
  const stackItems = stack
    .split(/[,/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)

  const primaryTech = stackItems[0] || stack || 'your declared tech stack'
  const secondaryTech = stackItems[1] || stackItems[0] || 'your core architecture'

  const currentStep = (qaHistory?.length || 0) + 1
  const candidateQuestions: string[] = []

  if (currentStep === 1) {
    // Question 1: ALWAYS explicitly targets the user's declared tech stack!
    if (stackItems.length >= 2) {
      candidateQuestions.push(`For Question 1: In building ${project} using ${primaryTech} and ${secondaryTech}, how did you design your core architecture, data flow, and component boundaries?`)
      candidateQuestions.push(`For Question 1: Regarding your implementation using ${primaryTech} alongside ${secondaryTech}, how do you manage state lifecycle, async requests, and error handling?`)
    } else {
      candidateQuestions.push(`For Question 1: Regarding your project ${project} built with ${primaryTech}, how did you structure your application architecture, data pipeline, and state management?`)
      candidateQuestions.push(`For Question 1: Can you walk me through why you chose ${primaryTech} for ${project}, and how its implementation handles core application logic?`)
    }
  } else if (currentStep === 2) {
    // Question 2: Stack Deep-Dive + Visual Screen OCR Evidence
    if (ocrLower.includes('function') || ocrLower.includes('const') || ocrLower.includes('import') || ocrLower.includes('class') || ocrLower.includes('def ')) {
      candidateQuestions.push(`Scanning the code visible on your screen: in your ${primaryTech} module, how do you handle asynchronous promises, error boundaries, and memory cleanup?`)
    }
    candidateQuestions.push(`In your ${primaryTech} implementation for ${project}, what was the most complex technical obstacle you encountered, and how did you resolve it?`)
    candidateQuestions.push(`How do ${primaryTech} and ${secondaryTech} interact in your system, and how do you validate data payloads passed between them?`)
  } else {
    // Question 3: Performance, Security & Scaling Trade-offs
    candidateQuestions.push(`Under 10x traffic or high concurrent load, where is the primary bottleneck in your ${primaryTech} setup, and what caching or indexing strategies would you apply?`)
    candidateQuestions.push(`What security mechanisms (such as CORS, input sanitization, token authorization) safeguard your ${primaryTech} implementation in ${project}?`)
    candidateQuestions.push(`How did you unit test and benchmark the critical paths of ${project} built with ${stack}?`)
  }

  // Pick first unused question from candidates
  const unused = candidateQuestions.filter((q) => !previousQuestions.some((pq) => pq.trim() === q.trim()))

  if (unused.length > 0) {
    const randomIndex = Math.floor(Math.random() * unused.length)
    return unused[randomIndex]
  }

  return `Regarding your project ${project} built with ${primaryTech}, can you explain the key architectural trade-offs you made during development?`
}



export async function analyzeScreen(source: HTMLVideoElement): Promise<string> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = source.videoWidth || 1280
    canvas.height = source.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    const worker = await createWorker('eng')
    const result = await worker.recognize(canvas)
    await worker.terminate()
    return result.data.text.trim()
  } catch (err) {
    return ''
  }
}

export function evaluateSession(
  project: string,
  stack: string,
  ocrText: string,
  qaHistory: QAItem[]
): LocalEvaluationReport {
  const allStudentText = qaHistory.map((item) => item.answer).join(' ')
  const allWords = allStudentText.split(/\s+/).filter(Boolean)
  const totalWordCount = allWords.length
  const lowerStudent = allStudentText.toLowerCase()
  const lowerOcr = ocrText.toLowerCase()

  const stackTerms = stack.split(/[,/\s+]+/).filter((t) => t.length > 1)
  const matchedStack = stackTerms.filter((st) => lowerStudent.includes(st.toLowerCase()) || lowerOcr.includes(st.toLowerCase()))

  const techKeywords = [
    'architecture',
    'api',
    'database',
    'state',
    'component',
    'async',
    'latency',
    'security',
    'schema',
    'token',
    'cache',
    'optimization',
    'deploy',
    'render',
    'query',
    'scale',
    'webgpu',
    'wasm',
    'ocr',
    'dom',
    'function',
    'class',
    'promise',
    'index',
  ]
  const matchedTech = Array.from(new Set([...techKeywords.filter((kw) => lowerStudent.includes(kw) || lowerOcr.includes(kw)), ...matchedStack]))

  // Evaluate each of the 3 questions individually
  const qaAssessments: QAAssessment[] = qaHistory.map((qa, index) => {
    const ansLower = qa.answer.toLowerCase()
    const ansWords = qa.answer.split(/\s+/).filter(Boolean).length
    const matchedInAns = stackTerms.filter((st) => ansLower.includes(st.toLowerCase()))

    let qScore = 65
    if (ansWords >= 15) qScore += 15
    if (ansWords >= 30) qScore += 10
    if (matchedInAns.length > 0) qScore += 10
    qScore = Math.min(98, Math.max(45, qScore))

    let feedback = ''
    if (ansWords < 10) {
      feedback = 'Response was extremely brief. Provide multi-sentence technical details.'
    } else if (matchedInAns.length > 0) {
      feedback = `Strong technical answer addressing ${matchedInAns.join(', ')} directly.`
    } else {
      feedback = 'Clear explanation, but incorporate more specific stack terminology.'
    }

    return {
      questionNumber: index + 1,
      question: qa.question,
      studentAnswer: qa.answer || 'No verbal response recorded.',
      score: qScore,
      feedback,
    }
  })

  // Dimension Scores
  let techScore = Math.min(96, 58 + matchedStack.length * 8 + matchedTech.length * 4 + (totalWordCount > 50 ? 10 : 0))
  if (totalWordCount < 20) techScore = Math.max(40, techScore - 20)

  let clarityScore = 74
  if (totalWordCount >= 40) clarityScore += 12
  if (lowerStudent.includes('because') || lowerStudent.includes('therefore') || lowerStudent.includes('for example') || lowerStudent.includes('specifically')) clarityScore += 8
  clarityScore = Math.min(98, Math.max(50, clarityScore))

  const customKeywords = ['trade-off', 'challenge', 'decided', 'custom', 'instead of', 'built', 'designed', 'choice', 'privacy', 'client-side', 'bottleneck']
  const matchedOriginality = customKeywords.filter((kw) => lowerStudent.includes(kw))
  let originalityScore = Math.min(96, 64 + matchedOriginality.length * 7)

  let understandingScore = 70
  if (ocrText.length > 15) understandingScore += 14
  if (matchedTech.length >= 2) understandingScore += 10
  understandingScore = Math.min(98, Math.max(50, understandingScore))

  const overallScore = qaAssessments.length > 0
    ? Math.round(qaAssessments.reduce((acc, q) => acc + q.score, 0) / qaAssessments.length)
    : Math.round((techScore + clarityScore + originalityScore + understandingScore) / 4)

  const strengths: string[] = []
  const improvements: string[] = []

  if (matchedStack.length > 0) strengths.push(`Addressed declared tech stack (${matchedStack.join(', ')}) across viva responses`)
  else improvements.push(`Explicitly mention implementation mechanics of ${stack} in your answers`)

  if (totalWordCount >= 40) strengths.push('Provided articulate, multi-sentence explanations for questions')
  else improvements.push('Expand your answers with more technical depth rather than short one-line responses')

  if (ocrText.length > 15) strengths.push('Effective presentation slides/code evidence captured during session')
  else improvements.push('Share presentation screen with code snippets to substantiate your explanations')

  const summaryText = overallScore >= 80
    ? `Exceptional technical viva performance for ${project}! You answered all 3 questions with solid understanding of ${stack}, backed by live visual evidence.`
    : `Good technical foundation for ${project} using ${stack}. Review the question-by-question breakdown below to refine your architecture trade-offs.`

  return {
    overallScore,
    technicalDepth: {
      score: techScore,
      note: techScore >= 80 ? `Solid technical depth in ${stack}` : `Add more specific trade-offs regarding ${stack}`,
    },
    clarity: {
      score: clarityScore,
      note: clarityScore >= 80 ? 'Clear logical structure across responses' : 'Structure responses with clear problem-solution-impact narratives',
    },
    originality: {
      score: originalityScore,
      note: originalityScore >= 80 ? 'Articulated trade-offs and engineering choices' : 'Highlight custom implementation details rather than generic templates',
    },
    understanding: {
      score: understandingScore,
      note: understandingScore >= 80 ? 'Answers aligned well with screen presentation evidence' : 'Ensure code snippets shown on screen are explained verbally',
    },
    summaryText,
    strengths: strengths.length ? strengths : [`Solid overall explanation of ${project}`],
    improvements: improvements.length ? improvements : [`Elaborate on performance tuning and security controls in ${stack}`],
    keyKeywordsFound: matchedTech,
    qaAssessments,
  }
}


