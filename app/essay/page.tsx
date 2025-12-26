'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    BookOpen,
    Globe,
    Hammer,
    Clock,
    Church,
    FlaskConical,
    PenTool,
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
    Upload,
    X,
    File,
    TrendingUp
} from 'lucide-react'

const SUBJECTS = [
    { id: 'english_language', name: 'English Language', icon: PenTool, color: 'from-zinc-600 to-zinc-800', accent: 'bg-zinc-700', description: 'Creative writing, SPaG, comprehension' },
    { id: 'english_literature', name: 'English Literature', icon: BookOpen, color: 'from-zinc-500 to-zinc-700', accent: 'bg-zinc-600', description: 'Character analysis, themes, quotations' },
    { id: 'geography', name: 'Geography', icon: Globe, color: 'from-zinc-600 to-zinc-800', accent: 'bg-zinc-700', description: 'Case studies, processes, terminology' },
    { id: 'history', name: 'History', icon: Clock, color: 'from-zinc-500 to-zinc-700', accent: 'bg-zinc-600', description: 'Evidence, causation, evaluation' },
    { id: 'product_design', name: 'Product Design', icon: Hammer, color: 'from-zinc-600 to-zinc-800', accent: 'bg-zinc-700', description: 'Materials, processes, sustainability' },
    { id: 'religious_studies', name: 'Religious Studies', icon: Church, color: 'from-zinc-500 to-zinc-700', accent: 'bg-zinc-600', description: 'Beliefs, ethics, perspectives' },
    { id: 'science', name: 'Science', icon: FlaskConical, color: 'from-zinc-600 to-zinc-800', accent: 'bg-zinc-700', description: 'Concepts, equations, explanations' },
    { id: 'ocr-gcse-economics', name: 'Economics (OCR GCSE)', icon: TrendingUp, color: 'from-zinc-500 to-zinc-700', accent: 'bg-zinc-600', description: 'Markets, economy, evaluation' },
]

interface EssayResponse {
    id: string
    subject: string
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
    feedback: string
    strengths: string[]
    improvements: string[]
    levelDescriptor?: string
}

interface UploadedFile {
    name: string
    text: string
    pages?: number
}

type ViewState = 'menu' | 'question' | 'writing' | 'result' | 'history'

export default function EssayPage() {
    const { user } = useAuth()
    const supabase = useMemo(() => createClient(), [])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [view, setView] = useState<ViewState>('menu')
    const [selectedSubject, setSelectedSubject] = useState<typeof SUBJECTS[0] | null>(null)
    const [question, setQuestion] = useState('')
    const [maxMarks, setMaxMarks] = useState('8')
    const [answer, setAnswer] = useState('')
    const [wordCount, setWordCount] = useState(0)
    const [isSaving, setIsSaving] = useState(false)
    const [isGrading, setIsGrading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [gradingResult, setGradingResult] = useState<GradingResult | null>(null)
    const [responses, setResponses] = useState<EssayResponse[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<EssayResponse | null>(null)
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

    // Check for query params from question generator
    const searchParams = useSearchParams()

    useEffect(() => {
        const qParam = searchParams.get('question')
        const mParam = searchParams.get('marks')
        const sParam = searchParams.get('subjectId')

        if (qParam && mParam && sParam && view === 'menu') {
            const subject = SUBJECTS.find(s => s.id === sParam)
            if (subject) {
                setSelectedSubject(subject)
                setQuestion(qParam)
                setMaxMarks(mParam)
                setView('writing')
                // Clean up URL without refresh
                window.history.replaceState({}, '', '/essay')
            }
        }
    }, [searchParams, view])

    useEffect(() => {
        const words = answer.trim().split(/\s+/).filter(w => w.length > 0)
        setWordCount(words.length)
    }, [answer])

    useEffect(() => {
        if (!user?.id || view !== 'writing' || !answer.trim()) return
        const saveInterval = setInterval(() => saveDraft(), 30000)
        return () => clearInterval(saveInterval)
    }, [user?.id, view, answer])

    useEffect(() => {
        if (view === 'history' && user?.id) loadHistory()
    }, [view, user?.id])

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
        if (!user?.id || !selectedSubject || !question || !answer.trim()) return
        setIsSaving(true)
        try {
            if (currentDraftId) {
                const { error } = await supabase.from('essay_responses').update({ answer, updated_at: new Date().toISOString() }).eq('id', currentDraftId).eq('user_id', user.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('essay_responses').insert({ user_id: user.id, subject: selectedSubject.id, question, max_marks: parseInt(maxMarks), answer, is_draft: true }).select('id').single()
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
            const { data, error } = await supabase.from('essay_responses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
            if (error) throw error
            setResponses((data as EssayResponse[]) || [])
        } catch (err) { console.error('Failed to load history:', err); toast.error('Failed to load history') }
        finally { setLoadingHistory(false) }
    }

    const deleteResponse = async (id: string) => {
        if (!user?.id) return
        setIsDeleting(true)
        try {
            const { error } = await supabase.from('essay_responses').delete().eq('id', id).eq('user_id', user.id)
            if (error) throw error
            setResponses(prev => prev.filter(r => r.id !== id))
            if (selectedHistoryItem?.id === id) setSelectedHistoryItem(null)
            toast.success('Response deleted')
        } catch (err) { console.error('Failed to delete:', err); toast.error('Failed to delete') }
        finally { setIsDeleting(false) }
    }

    const handleSubjectSelect = (subject: typeof SUBJECTS[0]) => { setSelectedSubject(subject); setView('question') }

    const handleQuestionSubmit = () => {
        if (!question.trim()) { toast.error('Please enter a question'); return }
        const marks = parseInt(maxMarks)
        if (isNaN(marks) || marks < 1 || marks > 40) { toast.error('Marks must be between 1 and 40'); return }
        setView('writing')
    }

    const handleGrade = async () => {
        if (!selectedSubject || !question || !answer.trim()) { toast.error('Please complete your answer before submitting'); return }
        if (answer.trim().length < 10) { toast.error('Your answer is too short'); return }
        setIsGrading(true)
        try {
            const context = getContextFromFiles()
            const response = await fetch('/api/essay/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: selectedSubject.id,
                    question,
                    answer,
                    maxMarks: parseInt(maxMarks),
                    context
                })
            })
            if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to grade essay') }
            const result: GradingResult = await response.json()
            setGradingResult(result)
            if (user?.id) {
                const feedbackJson = JSON.stringify({ feedback: result.feedback, strengths: result.strengths, improvements: result.improvements, levelDescriptor: result.levelDescriptor })
                if (currentDraftId) {
                    await supabase.from('essay_responses').update({ marks_awarded: result.marksAwarded, feedback: feedbackJson, is_draft: false, updated_at: new Date().toISOString() }).eq('id', currentDraftId)
                } else {
                    await supabase.from('essay_responses').insert({ user_id: user.id, subject: selectedSubject.id, question, max_marks: parseInt(maxMarks), answer, marks_awarded: result.marksAwarded, feedback: feedbackJson, is_draft: false })
                }
            }
            setView('result')
        } catch (err: any) { console.error('Grading error:', err); toast.error(err.message || 'Failed to grade essay') }
        finally { setIsGrading(false) }
    }

    const resetAll = () => { setView('menu'); setSelectedSubject(null); setQuestion(''); setMaxMarks('8'); setAnswer(''); setGradingResult(null); setCurrentDraftId(null); setLastSaved(null); setUploadedFiles([]) }
    const getSubjectById = (id: string) => SUBJECTS.find(s => s.id === id)
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const parseStoredFeedback = (feedbackStr: string | null): Partial<GradingResult> => { if (!feedbackStr) return {}; try { return JSON.parse(feedbackStr) } catch { return { feedback: feedbackStr } } }

    const dottedLineStyle = {
        background: `repeating-linear-gradient(transparent, transparent 31px, var(--border) 31px, var(--border) 32px)`,
        lineHeight: '32px',
        padding: '0',
        border: 'none',
        resize: 'none' as const,
        outline: 'none',
        fontSize: '16px',
        fontFamily: 'inherit',
    }

    const getBreadcrumbs = () => {
        const crumbs: { label: string; href?: string; onClick?: () => void }[] = [{ label: 'Essay Practice', onClick: resetAll }]

        if (view === 'history') {
            crumbs.push({ label: 'History' })
            if (selectedHistoryItem) {
                const subject = getSubjectById(selectedHistoryItem.subject)
                crumbs.push({ label: subject?.name || 'Response' })
            }
        } else if (selectedSubject) {
            crumbs.push({ label: selectedSubject.name, onClick: () => { setView('question') } })
            if (view === 'writing') crumbs.push({ label: 'Writing' })
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

                    {/* Writing view: marks badge and save button in header */}
                    {view === 'writing' && (
                        <div className="ml-auto flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">{maxMarks} marks</span>
                            {uploadedFiles.length > 0 && (
                                <span className="text-xs text-muted-foreground/60">{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</span>
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
            case 'menu':
                return (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto">
                        <div className="mb-10 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 mb-4">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Essay Practice</h1>
                            <p className="text-muted-foreground max-w-md mx-auto">Practice GCSE written questions with AI-powered feedback and grading</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {SUBJECTS.map((subject) => {
                                const Icon = subject.icon
                                return (
                                    <button
                                        key={subject.id}
                                        onClick={() => handleSubjectSelect(subject)}
                                        className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:border-foreground/20 transition-all duration-300 text-left"
                                    >
                                        <div className="p-6">
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                                <Icon className="w-6 h-6 text-white" />
                                            </div>
                                            <h3 className="font-semibold text-foreground text-lg mb-1 group-hover:text-foreground/90">{subject.name}</h3>
                                            <p className="text-sm text-muted-foreground">{subject.description}</p>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                )
                            })}
                        </div>

                        <div className="text-center">
                            <Button variant="outline" onClick={() => setView('history')} className="gap-2">
                                <History className="w-4 h-4" /> View Past Responses
                            </Button>
                        </div>
                    </div>
                )

            case 'question': {
                const marksValue = parseInt(maxMarks) || 8
                return (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col">
                        <div className="flex-1 flex flex-col justify-center -mt-16">
                            <div className="mb-10">
                                <textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Enter the exam question..."
                                    rows={3}
                                    className="w-full text-2xl md:text-3xl font-bold text-foreground placeholder:text-muted-foreground/30 bg-transparent border-none outline-none resize-none"
                                    style={{ borderBottom: '2px solid var(--border)', paddingBottom: '12px', lineHeight: '1.4' }}
                                />
                            </div>

                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm text-muted-foreground">Marks</span>
                                    <span className="text-3xl font-bold text-foreground">{marksValue}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="40"
                                    value={marksValue}
                                    onChange={(e) => setMaxMarks(e.target.value)}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-foreground"
                                    style={{ background: `linear-gradient(to right, hsl(var(--foreground)) 0%, hsl(var(--foreground)) ${((marksValue - 1) / 39) * 100}%, hsl(var(--muted)) ${((marksValue - 1) / 39) * 100}%, hsl(var(--muted)) 100%)` }}
                                />
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground/50">
                                    <span>1</span><span>10</span><span>20</span><span>30</span><span>40</span>
                                </div>
                            </div>

                            {/* File Upload Section */}
                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-muted-foreground">Mark scheme / Context (optional)</span>
                                    {uploadedFiles.length > 0 && (
                                        <span className="text-xs text-muted-foreground/60">{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</span>
                                    )}
                                </div>

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
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            <span>Upload PDF or text file</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <Button onClick={handleQuestionSubmit} size="lg" className="w-full md:w-auto md:self-start">
                                Start Writing <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    </div>
                )
            }

            case 'writing':
                return (
                    <div className="flex flex-col h-[calc(100vh-4rem)]">
                        {/* Question - large, left-aligned */}
                        <div className="px-8 md:px-12 pt-8 pb-6">
                            <p className="text-xl md:text-2xl font-semibold text-foreground leading-relaxed max-w-4xl">{question}</p>
                        </div>

                        {/* Answer area - aligned with question */}
                        <div className="flex-1 overflow-auto px-8 md:px-12">
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Start writing your answer..."
                                className="w-full max-w-4xl min-h-[55vh] bg-transparent text-foreground placeholder:text-muted-foreground/40"
                                style={dottedLineStyle}
                                autoFocus
                            />
                        </div>

                        {/* Footer with word count and submit */}
                        <div className="flex items-center justify-between px-8 md:px-12 py-4 border-t border-border/30 bg-background/80">
                            <span className="text-sm text-muted-foreground">{wordCount} words</span>
                            <Button onClick={handleGrade} disabled={isGrading || wordCount < 5}>
                                {isGrading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Grading...</> : <><Send className="w-4 h-4 mr-2" />Submit</>}
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
                            {gradingResult.levelDescriptor && <div className="mt-4 text-sm text-muted-foreground">{gradingResult.levelDescriptor}</div>}
                        </div>
                        <div className="space-y-4">
                            <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                <h3 className="font-semibold mb-2">Feedback</h3>
                                <p className="text-muted-foreground leading-relaxed">{gradingResult.feedback}</p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                {gradingResult.strengths.length > 0 && (
                                    <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                        <h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Strengths</h3>
                                        <ul className="space-y-2">{gradingResult.strengths.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}</ul>
                                    </div>
                                )}
                                {gradingResult.improvements.length > 0 && (
                                    <div className="p-5 rounded-xl bg-muted/20 border border-border/30">
                                        <h3 className="font-semibold mb-3 flex items-center gap-2"><XCircle className="w-4 h-4 text-muted-foreground" />Improve</h3>
                                        <ul className="space-y-2">{gradingResult.improvements.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}</ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-8 text-center">
                            <Button onClick={resetAll} variant="outline">Practice Another Question</Button>
                        </div>
                    </div>
                )

            case 'history':
                if (selectedHistoryItem) {
                    const subject = getSubjectById(selectedHistoryItem.subject)
                    const feedbackData = parseStoredFeedback(selectedHistoryItem.feedback)
                    return (
                        <div className="p-6 md:p-10 max-w-3xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    {subject && <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center`}><subject.icon className="w-5 h-5 text-white" /></div>}
                                    <div>
                                        <div className="font-semibold">{subject?.name}</div>
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
                                    const subject = getSubjectById(r.subject)
                                    return (
                                        <div key={r.id} className="group relative">
                                            <button onClick={() => setSelectedHistoryItem(r)} className="w-full p-4 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors text-left flex items-center gap-4">
                                                {subject && <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center flex-shrink-0`}><subject.icon className="w-6 h-6 text-white" /></div>}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium">{subject?.name}</span>
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
