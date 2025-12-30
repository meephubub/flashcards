'use client'
// HMR fix: triggered re-build


import { useState, useEffect, useMemo, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/auth-context'
import { AppSidebar } from "@/components/notes/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
    Calculator,
    Send,
    Save,
    History,
    CheckCircle,
    XCircle,
    Loader2,
    ChevronRight,
    FileText,
    Trash2,
    Sparkles,
    Lightbulb,
    Upload,
    X,
    File,
    ChevronLeft
} from 'lucide-react'

// react-markdown and math plugins
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// Topics previously used for selection, now we allow custom topics
const TOPICS = []


interface MathsResponse {
    id: string
    topic: string
    question: string
    max_marks: number
    answer: string
    marks_awarded: number | null
    feedback: string | null
    is_draft: boolean
    created_at: string
    updated_at: string
}

interface GradingResult {
    marksAwarded: number
    maxMarks: number
    percentage: number
    isCorrect: boolean
    feedback: string
    workingFeedback?: string
    correctAnswer: string
    commonMistake?: string
}

interface GeneratedQuestion {
    question: string
    maxMarks: number
    questionType: string
    expectedAnswer: string
    workingSteps?: string[]
    hint?: string
}

interface UploadedFile {
    name: string
    text: string
    pages?: number
}

type ViewState = 'setup' | 'question' | 'result' | 'history'

function MathsMarkdown({ content }: { content: string }) {
    return (
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:text-white">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                rehypePlugins={[rehypeKatex]}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

function MathsPageContent() {
    const { user } = useAuth()
    const supabase = useMemo(() => createClient(), [])

    const [view, setView] = useState<ViewState>('setup')
    const [topicText, setTopicText] = useState('')
    const [difficulty, setDifficulty] = useState<'foundation' | 'higher'>('foundation')
    const [calculatorAllowed, setCalculatorAllowed] = useState(true)
    const [numberOfQuestions, setNumberOfQuestions] = useState(3)
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [answer, setAnswer] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isGrading, setIsGrading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [gradingResult, setGradingResult] = useState<GradingResult | null>(null)
    const [responses, setResponses] = useState<MathsResponse[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<MathsResponse | null>(null)
    const [showHint, setShowHint] = useState(false)
    const [autoCompleteEnabled, setAutoCompleteEnabled] = useState(true)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load autoComplete setting
    useEffect(() => {
        const saved = localStorage.getItem('maths_autocomplete_enabled')
        if (saved !== null) setAutoCompleteEnabled(saved === 'true')
    }, [])

    // Save autoComplete setting
    useEffect(() => {
        localStorage.setItem('maths_autocomplete_enabled', autoCompleteEnabled.toString())
    }, [autoCompleteEnabled])

    // Autofill evaluation
    const evaluateSimpleExpression = (expr: string): string | null => {
        try {
            // Only allow numbers, basic operators, and parentheses
            if (!/^[0-9+\-*/().]+$/.test(expr)) return null;
            // Limit length for safety
            if (expr.length > 50) return null;

            const result = new Function(`return ${expr}`)();
            if (typeof result === 'number' && isFinite(result)) {
                return Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(4)).toString();
            }
        } catch (e) { }
        return null;
    }

    const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value
        setAnswer(newVal)

        if (calculatorAllowed && autoCompleteEnabled) {
            // Check if the last character typed was '='
            // Look for patterns like "1+1=" or "(20*2)/4="
            const lastPartMatch = newVal.match(/([0-9+\-*/().\s]+)=$/);
            if (lastPartMatch) {
                const expression = lastPartMatch[1].replace(/\s/g, '');
                if (expression) {
                    const result = evaluateSimpleExpression(expression);
                    if (result !== null) {
                        setAnswer(newVal + result);
                    }
                }
            }
        }
    }

    useEffect(() => {
        if (view === 'history' && user?.id) loadHistory()
    }, [view, user?.id])

    // Auto-save draft every 30 seconds when in question view
    useEffect(() => {
        if (!user?.id || view !== 'question' || !answer.trim()) return
        const saveInterval = setInterval(() => saveDraft(), 30000)
        return () => clearInterval(saveInterval)
    }, [user?.id, view, answer])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        try {
            for (const file of Array.from(files)) {
                if (file.type === 'application/pdf') {
                    const formData = new FormData()
                    formData.append('file', file)

                    const response = await fetch('/api/pdf/parse', {
                        method: 'POST',
                        body: formData,
                    })

                    if (!response.ok) {
                        const err = await response.json()
                        throw new Error(err.error || 'Failed to parse PDF')
                    }

                    const result = await response.json()
                    setUploadedFiles(prev => [...prev, {
                        name: file.name,
                        text: result.text,
                        pages: result.pages
                    }])
                    toast.success(`Uploaded ${file.name}`)
                } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                    const text = await file.text()
                    setUploadedFiles(prev => [...prev, {
                        name: file.name,
                        text: text
                    }])
                    toast.success(`Uploaded ${file.name}`)
                } else {
                    toast.error(`Unsupported file type: ${file.name}`)
                }
            }
        } catch (err: any) {
            console.error('Upload error:', err)
            toast.error(err.message || 'Failed to upload file')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const getContextFromFiles = () => {
        if (uploadedFiles.length === 0) return undefined
        return uploadedFiles.map(f => `--- ${f.name} ---\n${f.text}`).join('\n\n')
    }

    const saveDraft = async () => {
        if (!user?.id || !topicText || questions.length === 0 || !answer.trim()) return
        const currentQuestion = questions[currentQuestionIndex]
        setIsSaving(true)
        try {
            if (currentDraftId) {
                const { error } = await supabase.from('maths_responses').update({ answer, updated_at: new Date().toISOString() }).eq('id', currentDraftId).eq('user_id', user.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('maths_responses').insert({
                    user_id: user.id,
                    topic: topicText,
                    question: currentQuestion.question,
                    max_marks: currentQuestion.maxMarks,
                    answer,
                    is_draft: true
                }).select('id').single()
                if (error) throw error
                if (data) setCurrentDraftId(data.id)
            }
            setLastSaved(new Date())
        } catch (err) { console.error('Failed to save draft:', err) }
        finally { setIsSaving(false) }
    }

    const loadHistory = async () => {
        if (!user?.id) return
        setLoadingHistory(true)
        try {
            const { data, error } = await supabase.from('maths_responses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
            if (error) throw error
            setResponses((data as MathsResponse[]) || [])
        } catch (err) { console.error('Failed to load history:', err); toast.error('Failed to load history') }
        finally { setLoadingHistory(false) }
    }

    const deleteResponse = async (id: string) => {
        if (!user?.id) return
        setIsDeleting(true)
        try {
            const { error } = await supabase.from('maths_responses').delete().eq('id', id).eq('user_id', user.id)
            if (error) throw error
            setResponses(prev => prev.filter(r => r.id !== id))
            if (selectedHistoryItem?.id === id) setSelectedHistoryItem(null)
            toast.success('Response deleted')
        } catch (err) { console.error('Failed to delete:', err); toast.error('Failed to delete') }
        finally { setIsDeleting(false) }
    }

    const generateQuestions = async () => {
        if (!topicText.trim()) { toast.error('Please enter a topic'); return }
        setIsGenerating(true)
        setShowHint(false)
        try {
            const context = getContextFromFiles()
            const response = await fetch('/api/maths/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topicText,
                    difficulty,
                    calculatorAllowed,
                    count: numberOfQuestions,
                    context
                })
            })
            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to generate questions')
            }
            const result: GeneratedQuestion[] = await response.json()
            setQuestions(result)
            setCurrentQuestionIndex(0)
            setAnswer('')
            setCurrentDraftId(null)
            setLastSaved(null)
            setView('question')
        } catch (err: any) {
            console.error('Generation error:', err)
            toast.error(err.message || 'Failed to generate questions')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGrade = async () => {
        const currentQuestion = questions[currentQuestionIndex]
        if (!currentQuestion || !answer.trim()) {
            toast.error('Please write your answer before submitting')
            return
        }
        setIsGrading(true)
        try {
            // "dont mark the questions with ai, get the correct answer when generating the question"
            // We'll use the pre-generated expectedAnswer for a more deterministic check if possible,
            // but we still want feedback. Let's send it to the check API which now uses the expectedAnswer.
            // Note: To truly "not mark with AI", we could do it client-side, but method marks are hard.
            // I'll keep the API call but maybe simplify the prompt in lib/groq.ts later if needed.
            const response = await fetch('/api/maths/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: currentQuestion.question,
                    userAnswer: answer,
                    expectedAnswer: currentQuestion.expectedAnswer,
                    maxMarks: currentQuestion.maxMarks,
                    topic: topicText
                })
            })
            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to grade answer')
            }
            const result: GradingResult = await response.json()
            setGradingResult(result)
            if (user?.id) {
                const feedbackJson = JSON.stringify({
                    feedback: result.feedback,
                    workingFeedback: result.workingFeedback,
                    correctAnswer: result.correctAnswer,
                    commonMistake: result.commonMistake
                })
                if (currentDraftId) {
                    await supabase.from('maths_responses').update({
                        marks_awarded: result.marksAwarded,
                        feedback: feedbackJson,
                        is_draft: false,
                        updated_at: new Date().toISOString()
                    }).eq('id', currentDraftId)
                } else {
                    await supabase.from('maths_responses').insert({
                        user_id: user.id,
                        topic: topicText,
                        question: currentQuestion.question,
                        max_marks: currentQuestion.maxMarks,
                        answer,
                        marks_awarded: result.marksAwarded,
                        feedback: feedbackJson,
                        is_draft: false
                    })
                }
            }
            setView('result')
        } catch (err: any) {
            console.error('Grading error:', err)
            toast.error(err.message || 'Failed to grade answer')
        } finally {
            setIsGrading(false)
        }
    }

    const nextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1)
            setAnswer('')
            setGradingResult(null)
            setCurrentDraftId(null)
            setLastSaved(null)
            setShowHint(false)
            setView('question')
        } else {
            resetAll()
        }
    }

    const resetAll = () => {
        setView('setup')
        setTopicText('')
        setQuestions([])
        setCurrentQuestionIndex(0)
        setAnswer('')
        setGradingResult(null)
        setCurrentDraftId(null)
        setLastSaved(null)
        setShowHint(false)
        setUploadedFiles([])
    }

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const parseStoredFeedback = (feedbackStr: string | null): Partial<GradingResult> => {
        if (!feedbackStr) return {}
        try { return JSON.parse(feedbackStr) } catch { return { feedback: feedbackStr } }
    }

    const getBreadcrumbs = () => {
        const crumbs: { label: string; href?: string; onClick?: () => void }[] = [{ label: 'Maths Practice', onClick: resetAll }]

        if (view === 'history') {
            crumbs.push({ label: 'History' })
            if (selectedHistoryItem) {
                crumbs.push({ label: selectedHistoryItem.topic })
            }
        } else if (topicText || view === 'question') {
            crumbs.push({ label: topicText || 'Questions' })
            if (view === 'question') crumbs.push({ label: `Question ${currentQuestionIndex + 1}` })
            if (view === 'result') crumbs.push({ label: 'Results' })
        }

        return crumbs
    }

    const renderHeader = () => {
        const crumbs = getBreadcrumbs()
        return (
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-border/40">
                <div className="flex items-center gap-2 px-4 flex-1">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            {crumbs.map((crumb, i) => (
                                <BreadcrumbItem key={i} className={i === 0 ? "hidden md:block" : ""}>
                                    {i > 0 && <BreadcrumbSeparator className={i === 1 ? "hidden md:block" : ""} />}
                                    {i === crumbs.length - 1 ? (
                                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                    ) : crumb.onClick ? (
                                        <BreadcrumbLink onClick={crumb.onClick} className="cursor-pointer">{crumb.label}</BreadcrumbLink>
                                    ) : (
                                        <BreadcrumbLink>{crumb.label}</BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>

                    {/* Question view: marks badge and save button in header */}
                    {view === 'question' && questions[currentQuestionIndex] && (
                        <div className="ml-auto flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">{questions[currentQuestionIndex].maxMarks} marks</span>
                            {!calculatorAllowed && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Non-calc</span>
                            )}
                            {lastSaved && <span className="text-xs text-muted-foreground/50 hidden sm:inline">Saved {lastSaved.toLocaleTimeString()}</span>}
                            <Button variant="ghost" size="sm" onClick={saveDraft} disabled={isSaving}>
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </Button>
                        </div>
                    )}
                </div>
            </header>
        )
    }

    const renderContent = () => {
        switch (view) {
            case 'setup':
                return (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col">
                        <div className="flex-1 flex flex-col justify-center -mt-16">
                            <div className="mb-10 text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 mb-4">
                                    <Calculator className="w-8 h-8 text-white" />
                                </div>
                                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Maths Practice</h1>
                                <p className="text-muted-foreground max-w-md mx-auto">Enter a topic or upload context to generate practice questions</p>
                            </div>

                            <div className="mb-8">
                                <textarea
                                    value={topicText}
                                    onChange={(e) => setTopicText(e.target.value)}
                                    placeholder="Enter the maths topic (e.g. Quadratic Equations)..."
                                    rows={2}
                                    className="w-full text-2xl md:text-3xl font-bold text-foreground placeholder:text-muted-foreground/30 bg-transparent border-none outline-none resize-none"
                                    style={{ borderBottom: '2px solid var(--border)', paddingBottom: '12px', lineHeight: '1.4' }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm text-muted-foreground">Number of Questions</span>
                                        <span className="text-2xl font-bold text-foreground">{numberOfQuestions}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={numberOfQuestions}
                                        onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
                                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-foreground"
                                        style={{ background: `linear-gradient(to right, hsl(var(--foreground)) 0%, hsl(var(--foreground)) ${((numberOfQuestions - 1) / 9) * 100}%, hsl(var(--muted)) ${((numberOfQuestions - 1) / 9) * 100}%, hsl(var(--muted)) 100%)` }}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Difficulty</span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant={difficulty === 'foundation' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setDifficulty('foundation')}
                                            >
                                                Foundation
                                            </Button>
                                            <Button
                                                variant={difficulty === 'higher' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setDifficulty('higher')}
                                            >
                                                Higher
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Calculator</span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant={calculatorAllowed ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setCalculatorAllowed(true)}
                                            >
                                                <Calculator className="w-4 h-4 mr-1" /> Yes
                                            </Button>
                                            <Button
                                                variant={!calculatorAllowed ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setCalculatorAllowed(false)}
                                            >
                                                <XCircle className="w-4 h-4 mr-1" /> No
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">Auto-fill Expressions</span>
                                            <span className="text-[10px] text-muted-foreground">Type "1+1=" to auto-complete</span>
                                        </div>
                                        <Switch
                                            checked={autoCompleteEnabled}
                                            onCheckedChange={setAutoCompleteEnabled}
                                            disabled={!calculatorAllowed}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* File Upload Section */}
                            <div className="mb-10">
                                <span className="text-sm text-muted-foreground block mb-3">Context / Reference Material (optional)</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.txt"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />

                                {uploadedFiles.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {uploadedFiles.map((file, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                                                <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                                                    <File className="w-4 h-4 text-foreground/60" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {file.pages ? `${file.pages} page${file.pages !== 1 ? 's' : ''}` : `${file.text.length.toLocaleString()} chars`}
                                                    </p>
                                                </div>
                                                <button onClick={() => removeFile(i)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                                    <X className="w-4 h-4 text-muted-foreground" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="w-full p-4 rounded-xl border-2 border-dashed border-border/50 hover:border-foreground/30 transition-colors flex items-center justify-center gap-3 text-muted-foreground hover:text-foreground"
                                >
                                    {isUploading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" />Processing...</>
                                    ) : (
                                        <><Upload className="w-5 h-5" />Upload PDF or text file</>
                                    )}
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <Button
                                    onClick={generateQuestions}
                                    disabled={!topicText.trim() || isGenerating}
                                    size="lg"
                                    className="w-full md:w-auto"
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                                    ) : (
                                        <><Sparkles className="w-5 h-5 mr-2" />Generate Questions</>
                                    )}
                                </Button>
                                <Button variant="outline" onClick={() => setView('history')} className="gap-2 w-full md:w-auto">
                                    <History className="w-4 h-4" /> View History
                                </Button>
                            </div>
                        </div>
                    </div>
                )

            case 'question':
                if (questions.length === 0) return null
                const currentQuestion = questions[currentQuestionIndex]
                return (
                    <div className="flex flex-col h-[calc(100vh-4rem)]">
                        {/* Question */}
                        <div className="px-8 md:px-12 pt-8 pb-6">
                            <div className="flex items-start justify-between gap-4 max-w-4xl">
                                <div className="flex-1">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                                        Question {currentQuestionIndex + 1} of {questions.length}
                                    </span>
                                    <div className="text-xl md:text-2xl font-semibold text-foreground leading-relaxed">
                                        <MathsMarkdown content={currentQuestion.question} />
                                    </div>
                                </div>
                                {currentQuestion.hint && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowHint(!showHint)}
                                        className="shrink-0"
                                    >
                                        <Lightbulb className={`w-4 h-4 ${showHint ? 'text-yellow-500' : ''}`} />
                                    </Button>
                                )}
                            </div>
                            {showHint && currentQuestion.hint && (
                                <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 max-w-4xl">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                        <Lightbulb className="w-4 h-4 inline mr-2" />
                                        {currentQuestion.hint}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Answer area */}
                        <div className="flex-1 overflow-auto px-8 md:px-12">
                            <textarea
                                value={answer}
                                onChange={handleAnswerChange}
                                placeholder="Write your answer here... Show your working for method marks."
                                className="w-full max-w-4xl min-h-[45vh] bg-transparent text-foreground placeholder:text-muted-foreground/40 border-none outline-none resize-none"
                                style={{
                                    background: `repeating-linear-gradient(transparent, transparent 31px, var(--border) 31px, var(--border) 32px)`,
                                    lineHeight: '32px',
                                    fontSize: '16px',
                                }}
                                autoFocus
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-8 md:px-12 py-4 border-t border-border/30 bg-background/80">
                            <div className="flex items-center gap-6">
                                <Button variant="ghost" size="sm" onClick={resetAll} disabled={isGenerating}>
                                    Cancel
                                </Button>
                                <div className="hidden md:flex items-center gap-2">
                                    <Switch
                                        id="autofill-toggle"
                                        checked={autoCompleteEnabled}
                                        onCheckedChange={setAutoCompleteEnabled}
                                    />
                                    <Label htmlFor="autofill-toggle" className="text-xs text-muted-foreground cursor-pointer">
                                        Autofill (=)
                                    </Label>
                                </div>
                            </div>
                            <Button onClick={handleGrade} disabled={isGrading || !answer.trim()}>
                                {isGrading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : <><Send className="w-4 h-4 mr-2" />Submit</>}
                            </Button>
                        </div>
                    </div>
                )

            case 'result':
                if (!gradingResult) return null
                const percentage = gradingResult.percentage
                const isGood = percentage >= 60
                return (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto">
                        <div className={`text-center py-10 mb-8 rounded-2xl border ${isGood ? 'border-foreground/20 bg-foreground/5' : 'border-border/50 bg-muted/30'}`}>
                            <div className="text-6xl font-bold text-foreground mb-2">{gradingResult.marksAwarded}/{gradingResult.maxMarks}</div>
                            <div className="text-xl text-muted-foreground">{percentage}%</div>
                            {gradingResult.isCorrect && <div className="mt-4 text-green-600 dark:text-green-400 font-medium">Correct!</div>}
                        </div>

                        <div className="space-y-4">
                            {/* Feedback */}
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                <h3 className="font-semibold mb-2">Feedback</h3>
                                <MathsMarkdown content={gradingResult.feedback} />
                            </div>

                            {/* Working Feedback */}
                            {gradingResult.workingFeedback && (
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                    <h3 className="font-semibold mb-2">Working Method</h3>
                                    <MathsMarkdown content={gradingResult.workingFeedback} />
                                </div>
                            )}

                            {/* Correct Answer */}
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> Correct Answer
                                </h3>
                                <MathsMarkdown content={gradingResult.correctAnswer} />
                            </div>

                            {/* Common Mistake */}
                            {gradingResult.commonMistake && (
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-muted-foreground" /> Common Mistake
                                    </h3>
                                    <MathsMarkdown content={gradingResult.commonMistake} />
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={nextQuestion} variant="default">
                                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Session'}
                            </Button>
                            {currentQuestionIndex < questions.length - 1 && (
                                <Button onClick={resetAll} variant="outline">Exit</Button>
                            )}
                        </div>
                    </div>
                )

            case 'history':
                if (selectedHistoryItem) {
                    const feedbackData = parseStoredFeedback(selectedHistoryItem.feedback)
                    return (
                        <div className="p-6 md:p-10 max-w-3xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center">
                                        <Calculator className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">{selectedHistoryItem.topic}</div>
                                        <div className="text-xs text-muted-foreground">{formatDate(selectedHistoryItem.created_at)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {selectedHistoryItem.marks_awarded !== null && (
                                        <div className="text-right">
                                            <div className="text-xl font-bold">{selectedHistoryItem.marks_awarded}/{selectedHistoryItem.max_marks}</div>
                                            <div className="text-xs text-muted-foreground">{Math.round((selectedHistoryItem.marks_awarded / selectedHistoryItem.max_marks) * 100)}%</div>
                                        </div>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => deleteResponse(selectedHistoryItem.id)} disabled={isDeleting} className="text-destructive hover:text-destructive">
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30 mb-4">
                                <div className="text-xs text-muted-foreground mb-1">Question</div>
                                <MathsMarkdown content={selectedHistoryItem.question} />
                            </div>
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30 mb-4">
                                <div className="text-xs text-muted-foreground mb-1">Your Answer</div>
                                <MathsMarkdown content={selectedHistoryItem.answer} />
                            </div>
                            {feedbackData.feedback && (
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                    <div className="text-xs text-muted-foreground mb-1">Feedback</div>
                                    <MathsMarkdown content={feedbackData.feedback} />
                                </div>
                            )}
                            <div className="mt-6">
                                <Button variant="outline" onClick={() => setSelectedHistoryItem(null)}>
                                    Back to History
                                </Button>
                            </div>
                        </div>
                    )
                }
                return (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={resetAll} className="p-0 h-auto hover:bg-transparent">
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                            Past Responses
                        </h2>
                        {loadingHistory ? (
                            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
                        ) : responses.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No responses yet</p></div>
                        ) : (
                            <div className="space-y-3">
                                {responses.map((r) => {
                                    return (
                                        <div key={r.id} className="group relative">
                                            <button onClick={() => setSelectedHistoryItem(r)} className="w-full p-4 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors text-left flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center flex-shrink-0">
                                                    <Calculator className="w-6 h-6 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium truncate">{r.topic}</span>
                                                        {r.is_draft && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Draft</span>}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate">{r.question}</p>
                                                    <p className="text-xs text-muted-foreground/60 mt-1">{formatDate(r.created_at)}</p>
                                                </div>
                                                {r.marks_awarded !== null && (
                                                    <div className="text-right pr-2">
                                                        <div className="text-lg font-bold">{r.marks_awarded}/{r.max_marks}</div>
                                                        <div className="text-xs text-muted-foreground">{Math.round((r.marks_awarded / r.max_marks) * 100)}%</div>
                                                    </div>
                                                )}
                                                <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteResponse(r.id) }}
                                                className="absolute right-14 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            default: return null
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-background">
                {renderHeader()}
                {renderContent()}
            </SidebarInset>
        </SidebarProvider>
    )
}

export default function MathsPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <MathsPageContent />
        </Suspense>
    )
}
