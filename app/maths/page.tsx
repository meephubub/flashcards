'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
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
    RefreshCw,
    CalculatorIcon
} from 'lucide-react'

const TOPICS = [
    { id: 'algebra', name: 'Algebra', icon: 'x²', description: 'Equations, expressions, sequences' },
    { id: 'geometry', name: 'Geometry', icon: '△', description: 'Shapes, angles, trigonometry' },
    { id: 'statistics', name: 'Statistics', icon: 'σ', description: 'Data, probability, averages' },
    { id: 'number', name: 'Number', icon: '%', description: 'Fractions, ratios, percentages' },
    { id: 'graphs', name: 'Graphs', icon: '📈', description: 'Linear, quadratic, interpreting' },
]

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

type ViewState = 'topic' | 'question' | 'result' | 'history'

function MathsPageContent() {
    const { user } = useAuth()
    const supabase = useMemo(() => createClient(), [])

    const [view, setView] = useState<ViewState>('topic')
    const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null)
    const [difficulty, setDifficulty] = useState<'foundation' | 'higher'>('foundation')
    const [calculatorAllowed, setCalculatorAllowed] = useState(true)
    const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedQuestion | null>(null)
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

    useEffect(() => {
        if (view === 'history' && user?.id) loadHistory()
    }, [view, user?.id])

    // Auto-save draft every 30 seconds when in question view
    useEffect(() => {
        if (!user?.id || view !== 'question' || !answer.trim()) return
        const saveInterval = setInterval(() => saveDraft(), 30000)
        return () => clearInterval(saveInterval)
    }, [user?.id, view, answer])

    const saveDraft = async () => {
        if (!user?.id || !selectedTopic || !generatedQuestion || !answer.trim()) return
        setIsSaving(true)
        try {
            if (currentDraftId) {
                const { error } = await supabase.from('maths_responses').update({ answer, updated_at: new Date().toISOString() }).eq('id', currentDraftId).eq('user_id', user.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('maths_responses').insert({
                    user_id: user.id,
                    topic: selectedTopic.id,
                    question: generatedQuestion.question,
                    max_marks: generatedQuestion.maxMarks,
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

    const generateQuestion = async () => {
        if (!selectedTopic) { toast.error('Please select a topic'); return }
        setIsGenerating(true)
        setShowHint(false)
        try {
            const response = await fetch('/api/maths/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: selectedTopic.id,
                    difficulty,
                    calculatorAllowed
                })
            })
            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to generate question')
            }
            const result: GeneratedQuestion = await response.json()
            setGeneratedQuestion(result)
            setAnswer('')
            setCurrentDraftId(null)
            setLastSaved(null)
            setView('question')
        } catch (err: any) {
            console.error('Generation error:', err)
            toast.error(err.message || 'Failed to generate question')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGrade = async () => {
        if (!generatedQuestion || !answer.trim()) {
            toast.error('Please write your answer before submitting')
            return
        }
        setIsGrading(true)
        try {
            const response = await fetch('/api/maths/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: generatedQuestion.question,
                    userAnswer: answer,
                    expectedAnswer: generatedQuestion.expectedAnswer,
                    maxMarks: generatedQuestion.maxMarks,
                    topic: selectedTopic?.id
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
                        topic: selectedTopic?.id,
                        question: generatedQuestion.question,
                        max_marks: generatedQuestion.maxMarks,
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

    const resetAll = () => {
        setView('topic')
        setSelectedTopic(null)
        setGeneratedQuestion(null)
        setAnswer('')
        setGradingResult(null)
        setCurrentDraftId(null)
        setLastSaved(null)
        setShowHint(false)
    }

    const tryAnother = () => {
        setAnswer('')
        setGradingResult(null)
        setCurrentDraftId(null)
        setLastSaved(null)
        setShowHint(false)
        generateQuestion()
    }

    const getTopicById = (id: string) => TOPICS.find(t => t.id === id)

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
                const topic = getTopicById(selectedHistoryItem.topic)
                crumbs.push({ label: topic?.name || 'Question' })
            }
        } else if (selectedTopic) {
            crumbs.push({ label: selectedTopic.name })
            if (view === 'question') crumbs.push({ label: 'Solving' })
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
                    {view === 'question' && generatedQuestion && (
                        <div className="ml-auto flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">{generatedQuestion.maxMarks} marks</span>
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
            case 'topic':
                return (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto">
                        <div className="mb-10 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 mb-4">
                                <Calculator className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Maths Practice</h1>
                            <p className="text-muted-foreground max-w-md mx-auto">Generate GCSE maths questions and get AI-powered feedback</p>
                        </div>

                        {/* Topic Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {TOPICS.map((topic) => (
                                <button
                                    key={topic.id}
                                    onClick={() => setSelectedTopic(topic)}
                                    className={`group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 text-left ${selectedTopic?.id === topic.id
                                            ? 'border-foreground/40 ring-2 ring-foreground/20'
                                            : 'border-border/50 hover:border-foreground/20'
                                        }`}
                                >
                                    <div className="p-6">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                            <span className="text-xl text-white font-mono">{topic.icon}</span>
                                        </div>
                                        <h3 className="font-semibold text-foreground text-lg mb-1">{topic.name}</h3>
                                        <p className="text-sm text-muted-foreground">{topic.description}</p>
                                    </div>
                                    {selectedTopic?.id === topic.id && (
                                        <div className="absolute top-3 right-3">
                                            <CheckCircle className="w-5 h-5 text-foreground" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Options */}
                        {selectedTopic && (
                            <div className="space-y-6 mb-8">
                                {/* Difficulty */}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30">
                                    <div>
                                        <span className="font-medium">Difficulty</span>
                                        <p className="text-sm text-muted-foreground">Foundation (1-5) or Higher (4-9)</p>
                                    </div>
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

                                {/* Calculator */}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30">
                                    <div>
                                        <span className="font-medium">Calculator</span>
                                        <p className="text-sm text-muted-foreground">Allow calculator for this question?</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={calculatorAllowed ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setCalculatorAllowed(true)}
                                        >
                                            <CalculatorIcon className="w-4 h-4 mr-1" /> Yes
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
                            </div>
                        )}

                        {/* Generate Button */}
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Button
                                onClick={generateQuestion}
                                disabled={!selectedTopic || isGenerating}
                                size="lg"
                                className="w-full sm:w-auto"
                            >
                                {isGenerating ? (
                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                                ) : (
                                    <><Sparkles className="w-5 h-5 mr-2" />Generate Question</>
                                )}
                            </Button>
                            <Button variant="outline" onClick={() => setView('history')} className="gap-2 w-full sm:w-auto">
                                <History className="w-4 h-4" /> View Past Responses
                            </Button>
                        </div>
                    </div>
                )

            case 'question':
                if (!generatedQuestion) return null
                return (
                    <div className="flex flex-col h-[calc(100vh-4rem)]">
                        {/* Question */}
                        <div className="px-8 md:px-12 pt-8 pb-6">
                            <div className="flex items-start justify-between gap-4 max-w-4xl">
                                <p className="text-xl md:text-2xl font-semibold text-foreground leading-relaxed flex-1">
                                    {generatedQuestion.question}
                                </p>
                                {generatedQuestion.hint && (
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
                            {showHint && generatedQuestion.hint && (
                                <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 max-w-4xl">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                        <Lightbulb className="w-4 h-4 inline mr-2" />
                                        {generatedQuestion.hint}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Answer area */}
                        <div className="flex-1 overflow-auto px-8 md:px-12">
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
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
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="sm" onClick={tryAnother} disabled={isGenerating}>
                                    <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                                    New Question
                                </Button>
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
                                <p className="text-muted-foreground leading-relaxed">{gradingResult.feedback}</p>
                            </div>

                            {/* Working Feedback */}
                            {gradingResult.workingFeedback && (
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                    <h3 className="font-semibold mb-2">Working Method</h3>
                                    <p className="text-muted-foreground">{gradingResult.workingFeedback}</p>
                                </div>
                            )}

                            {/* Correct Answer */}
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> Correct Answer
                                </h3>
                                <p className="text-muted-foreground font-mono">{gradingResult.correctAnswer}</p>
                            </div>

                            {/* Common Mistake */}
                            {gradingResult.commonMistake && (
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-muted-foreground" /> Common Mistake
                                    </h3>
                                    <p className="text-muted-foreground">{gradingResult.commonMistake}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={tryAnother} variant="default">
                                <RefreshCw className="w-4 h-4 mr-2" /> Try Another Question
                            </Button>
                            <Button onClick={resetAll} variant="outline">Change Topic</Button>
                        </div>
                    </div>
                )

            case 'history':
                if (selectedHistoryItem) {
                    const topic = getTopicById(selectedHistoryItem.topic)
                    const feedbackData = parseStoredFeedback(selectedHistoryItem.feedback)
                    return (
                        <div className="p-6 md:p-10 max-w-3xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    {topic && (
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center">
                                            <span className="text-lg text-white font-mono">{topic.icon}</span>
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-semibold">{topic?.name}</div>
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
                                <p className="font-medium">{selectedHistoryItem.question}</p>
                            </div>
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30 mb-4">
                                <div className="text-xs text-muted-foreground mb-1">Your Answer</div>
                                <p className="text-muted-foreground whitespace-pre-wrap">{selectedHistoryItem.answer}</p>
                            </div>
                            {feedbackData.feedback && (
                                <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                    <div className="text-xs text-muted-foreground mb-1">Feedback</div>
                                    <p className="text-muted-foreground">{feedbackData.feedback}</p>
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
                        <h2 className="text-xl font-semibold mb-6">Past Responses</h2>
                        {loadingHistory ? (
                            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
                        ) : responses.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No responses yet</p></div>
                        ) : (
                            <div className="space-y-3">
                                {responses.map((r) => {
                                    const topic = getTopicById(r.topic)
                                    return (
                                        <div key={r.id} className="group relative">
                                            <button onClick={() => setSelectedHistoryItem(r)} className="w-full p-4 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors text-left flex items-center gap-4">
                                                {topic && (
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xl text-white font-mono">{topic.icon}</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium">{topic?.name}</span>
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
                                            {r.is_draft && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteResponse(r.id) }}
                                                    className="absolute right-14 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
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
