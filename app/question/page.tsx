'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/auth-context'
import { AppSidebar } from "@/components/notes/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    BookOpen,
    Globe,
    Hammer,
    Clock,
    Church,
    FlaskConical,
    PenTool,
    Loader2,
    ChevronRight,
    FileText,
    TrendingUp,
    Library,
    StickyNote,
    Upload,
    X,
    Sparkles,
    CheckCircle2,
    ArrowRight,
    Check
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const SUBJECTS = [
    { id: 'english_language', name: 'English Language', icon: PenTool, color: 'from-zinc-600 to-zinc-800', description: 'Creative writing, SPaG' },
    { id: 'english_literature', name: 'English Literature', icon: BookOpen, color: 'from-zinc-500 to-zinc-700', description: 'Analysis, themes' },
    { id: 'geography', name: 'Geography', icon: Globe, color: 'from-zinc-600 to-zinc-800', description: 'Case studies, processes' },
    { id: 'history', name: 'History', icon: Clock, color: 'from-zinc-500 to-zinc-700', description: 'Evidence, evaluation' },
    { id: 'product_design', name: 'Product Design', icon: Hammer, color: 'from-zinc-600 to-zinc-800', description: 'Materials, processes' },
    { id: 'religious_studies', name: 'Religious Studies', icon: Church, color: 'from-zinc-500 to-zinc-700', description: 'Beliefs, ethics' },
    { id: 'science', name: 'Science', icon: FlaskConical, color: 'from-zinc-600 to-zinc-800', description: 'Concepts, explanations' },
    { id: 'ocr-gcse-economics', name: 'Economics', icon: TrendingUp, color: 'from-zinc-500 to-zinc-700', description: 'Markets, evaluation' },
]

type Step = 'subject' | 'sources' | 'result'

const STEPS: { key: Step; label: string }[] = [
    { key: 'subject', label: 'Subject' },
    { key: 'sources', label: 'Sources' },
    { key: 'result', label: 'Question' },
]

interface Note {
    id: string
    title: string
    content: string
}

interface Deck {
    id: number
    name: string
    description: string
    card_count: number
}

interface UploadedFile {
    name: string
    content: string
}

function StepIndicator({ currentStep, onStepClick }: { currentStep: Step; onStepClick: (step: Step) => void }) {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep)

    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => {
                const isCompleted = i < currentIndex
                const isCurrent = s.key === currentStep
                const isClickable = i < currentIndex

                return (
                    <div key={s.key} className="flex items-center gap-2">
                        <button
                            onClick={() => isClickable && onStepClick(s.key)}
                            disabled={!isClickable}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
                                isCurrent && "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md",
                                isCompleted && "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer",
                                !isCurrent && !isCompleted && "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                            )}
                        >
                            {isCompleted ? (
                                <Check className="w-3.5 h-3.5" />
                            ) : (
                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/10 text-xs">
                                    {i + 1}
                                </span>
                            )}
                            <span className="hidden sm:inline">{s.label}</span>
                        </button>
                        {i < STEPS.length - 1 && (
                            <ChevronRight className={cn(
                                "w-4 h-4 transition-colors duration-300",
                                i < currentIndex ? "text-zinc-400" : "text-zinc-200 dark:text-zinc-700"
                            )} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="max-w-3xl mx-auto animate-pulse">
            <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="space-y-4">
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-3/4 mx-auto" />
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800/50 rounded w-1/2 mx-auto" />
            </div>
            <div className="mt-10 space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl" />
                ))}
            </div>
        </div>
    )
}

export default function QuestionPage() {
    const { user } = useAuth()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [step, setStep] = useState<Step>('subject')
    const [selectedSubject, setSelectedSubject] = useState<typeof SUBJECTS[0] | null>(null)
    const [generatedQuestion, setGeneratedQuestion] = useState<string | null>(null)
    const [marks, setMarks] = useState([8])
    const [isGenerating, setIsGenerating] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Source Data
    const [notes, setNotes] = useState<Note[]>([])
    const [decks, setDecks] = useState<Deck[]>([])
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

    // Selections
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
    const [selectedDeckIds, setSelectedDeckIds] = useState<number[]>([])

    // Load User Data
    useEffect(() => {
        if (!user) {
            setIsLoading(false)
            return
        }
        const fetchData = async () => {
            setIsLoading(true)
            const { data: notesData } = await supabase.from('notes').select('id, title, content').order('updated_at', { ascending: false })
            if (notesData) setNotes(notesData)

            const { data: decksData } = await supabase.from('decks').select('id, name, description, card_count').order('last_studied', { ascending: false })
            if (decksData) setDecks(decksData)
            setIsLoading(false)
        }
        fetchData()
    }, [user, supabase])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        for (const file of Array.from(files)) {
            if (file.type === 'text/plain') {
                const text = await file.text()
                setUploadedFiles(prev => [...prev, { name: file.name, content: text }])
                toast.success(`Uploaded ${file.name}`)
            } else if (file.type === 'application/pdf') {
                const formData = new FormData()
                formData.append('file', file)
                try {
                    const res = await fetch('/api/pdf/parse', { method: 'POST', body: formData })
                    if (!res.ok) throw new Error('Failed to parse PDF')
                    const data = await res.json()
                    setUploadedFiles(prev => [...prev, { name: file.name, content: data.text }])
                    toast.success(`Uploaded ${file.name}`)
                } catch (err) {
                    toast.error('Failed to parse PDF')
                }
            } else {
                toast.error('Unsupported file type')
            }
        }
    }

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const toggleNote = (id: string) => {
        setSelectedNoteIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const toggleDeck = (id: number) => {
        setSelectedDeckIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const generateQuestion = async () => {
        if (!selectedSubject) return

        setIsGenerating(true)
        try {
            // Aggregate content
            let content = ''

            // Add Notes
            const selectedNotes = notes.filter(n => selectedNoteIds.includes(n.id))
            if (selectedNotes.length) {
                content += "--- NOTES ---\n"
                content += selectedNotes.map(n => `Title: ${n.title}\n${n.content}`).join('\n\n')
                content += "\n\n"
            }

            // Add Decks
            if (selectedDeckIds.length > 0) {
                const { data: cards } = await supabase.from('cards').select('front, back').in('deck_id', selectedDeckIds)
                if (cards && cards.length > 0) {
                    content += "--- FLASHCARDS ---\n"
                    content += cards.map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n')
                    content += "\n\n"
                }
            }

            // Add Files
            if (uploadedFiles.length) {
                content += "--- UPLOADED DOCUMENTS ---\n"
                content += uploadedFiles.map(f => `File: ${f.name}\n${f.content}`).join('\n\n')
            }

            if (!content.trim()) {
                toast.error("Please select at least one source of content.")
                setIsGenerating(false)
                return
            }

            const response = await fetch('/api/question/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: selectedSubject.name,
                    sources: content,
                    marks: marks[0]
                })
            })

            if (!response.ok) throw new Error('Failed to generate')
            const data = await response.json()
            setGeneratedQuestion(data.question)
            setStep('result')
        } catch (error) {
            console.error(error)
            toast.error("Failed to generate question")
        } finally {
            setIsGenerating(false)
        }
    }

    const reset = () => {
        setStep('subject')
        setSelectedSubject(null)
        setGeneratedQuestion(null)
        setSelectedNoteIds([])
        setSelectedDeckIds([])
        setUploadedFiles([])
    }

    const goToEssay = () => {
        if (!selectedSubject || !generatedQuestion) return
        const params = new URLSearchParams({
            question: generatedQuestion,
            marks: marks[0].toString(),
            subjectId: selectedSubject.id
        })
        router.push(`/essay?${params.toString()}`)
    }

    const handleStepClick = (targetStep: Step) => {
        const targetIndex = STEPS.findIndex(s => s.key === targetStep)
        const currentIndex = STEPS.findIndex(s => s.key === step)
        if (targetIndex < currentIndex) {
            setStep(targetStep)
        }
    }

    // Breadcrumbs
    const crumbs = [
        { label: 'Question Generator', onClick: reset },
    ]
    if (step === 'sources' && selectedSubject) crumbs.push({ label: selectedSubject.name, onClick: () => { } })
    if (step === 'result') {
        crumbs.push({ label: selectedSubject?.name || 'Subject', onClick: () => setStep('sources') })
        crumbs.push({ label: 'Result', onClick: () => { } })
    }

    const totalSelected = selectedNoteIds.length + selectedDeckIds.length + uploadedFiles.length

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-background">
                <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            {crumbs.map((crumb, i) => (
                                <BreadcrumbItem key={i}>
                                    {i > 0 && <BreadcrumbSeparator />}
                                    {crumb.onClick && i !== crumbs.length - 1 ? (
                                        <BreadcrumbLink onClick={crumb.onClick} className="cursor-pointer">{crumb.label}</BreadcrumbLink>
                                    ) : (
                                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                    )}
                                </BreadcrumbItem>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <div className="flex-1 overflow-auto p-6 md:p-10">
                    {isLoading ? (
                        <LoadingSkeleton />
                    ) : (
                        <>
                            <StepIndicator currentStep={step} onStepClick={handleStepClick} />

                            {/* Step 1: Subject Selection */}
                            <div className={cn(
                                "transition-all duration-500 ease-out",
                                step === 'subject' ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute pointer-events-none"
                            )}>
                                {step === 'subject' && (
                                    <div className="max-w-4xl mx-auto">
                                        <div className="mb-10 text-center">
                                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 mb-4 shadow-lg shadow-zinc-500/20">
                                                <Sparkles className="w-8 h-8 text-white" />
                                            </div>
                                            <h1 className="text-3xl md:text-4xl font-bold mb-2">Generate Exam Questions</h1>
                                            <p className="text-muted-foreground">Turn your notes and flashcards into exam-style practice questions</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {SUBJECTS.map((subject, i) => {
                                                const Icon = subject.icon
                                                return (
                                                    <button
                                                        key={subject.id}
                                                        onClick={() => { setSelectedSubject(subject); setStep('sources') }}
                                                        className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:border-foreground/20 transition-all duration-300 text-left hover:shadow-xl hover:-translate-y-1"
                                                        style={{ animationDelay: `${i * 50}ms` }}
                                                    >
                                                        <div className="p-6">
                                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-md`}>
                                                                <Icon className="w-6 h-6 text-white" />
                                                            </div>
                                                            <h3 className="font-semibold text-lg mb-1 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">{subject.name}</h3>
                                                            <p className="text-sm text-muted-foreground">{subject.description}</p>
                                                        </div>
                                                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-100/50 dark:from-zinc-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Source Selection */}
                            <div className={cn(
                                "transition-all duration-500 ease-out",
                                step === 'sources' ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 absolute pointer-events-none"
                            )}>
                                {step === 'sources' && (
                                    <div className="max-w-3xl mx-auto">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                                <Library className="w-6 h-6" /> Select Sources
                                            </h2>
                                            {totalSelected > 0 && (
                                                <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm font-medium">
                                                    {totalSelected} selected
                                                </span>
                                            )}
                                        </div>

                                        <Tabs defaultValue="notes" className="w-full">
                                            <TabsList className="grid w-full grid-cols-3 mb-6 h-12">
                                                <TabsTrigger value="notes" className="data-[state=active]:shadow-md transition-shadow">
                                                    <StickyNote className="w-4 h-4 mr-2" />
                                                    Notes {selectedNoteIds.length > 0 && `(${selectedNoteIds.length})`}
                                                </TabsTrigger>
                                                <TabsTrigger value="decks" className="data-[state=active]:shadow-md transition-shadow">
                                                    <Library className="w-4 h-4 mr-2" />
                                                    Decks {selectedDeckIds.length > 0 && `(${selectedDeckIds.length})`}
                                                </TabsTrigger>
                                                <TabsTrigger value="files" className="data-[state=active]:shadow-md transition-shadow">
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    Files {uploadedFiles.length > 0 && `(${uploadedFiles.length})`}
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="notes" className="min-h-[400px]">
                                                <ScrollArea className="h-[400px] border rounded-xl p-4 bg-muted/20">
                                                    {notes.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                                            <StickyNote className="w-12 h-12 mb-3 opacity-50" />
                                                            <p>No notes found. Create some notes first!</p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid gap-3">
                                                            {notes.map((note, i) => (
                                                                <div
                                                                    key={note.id}
                                                                    onClick={() => toggleNote(note.id)}
                                                                    className={cn(
                                                                        "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                                                                        selectedNoteIds.includes(note.id)
                                                                            ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 shadow-sm scale-[1.02]'
                                                                            : 'hover:bg-muted/50 border-border/50 hover:border-border'
                                                                    )}
                                                                    style={{ animationDelay: `${i * 30}ms` }}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn(
                                                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                                                                            selectedNoteIds.includes(note.id) ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100' : 'border-zinc-300 dark:border-zinc-600'
                                                                        )}>
                                                                            {selectedNoteIds.includes(note.id) && <Check className="w-3 h-3 text-white dark:text-zinc-900" />}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h3 className="font-medium truncate">{note.title}</h3>
                                                                            <p className="text-xs text-muted-foreground truncate">{note.content.substring(0, 60)}...</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </ScrollArea>
                                            </TabsContent>

                                            <TabsContent value="decks" className="min-h-[400px]">
                                                <ScrollArea className="h-[400px] border rounded-xl p-4 bg-muted/20">
                                                    {decks.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                                            <Library className="w-12 h-12 mb-3 opacity-50" />
                                                            <p>No decks found. Create some flashcards first!</p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid gap-3">
                                                            {decks.map((deck, i) => (
                                                                <div
                                                                    key={deck.id}
                                                                    onClick={() => toggleDeck(deck.id)}
                                                                    className={cn(
                                                                        "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                                                                        selectedDeckIds.includes(deck.id)
                                                                            ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 shadow-sm scale-[1.02]'
                                                                            : 'hover:bg-muted/50 border-border/50 hover:border-border'
                                                                    )}
                                                                    style={{ animationDelay: `${i * 30}ms` }}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn(
                                                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                                                                            selectedDeckIds.includes(deck.id) ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100' : 'border-zinc-300 dark:border-zinc-600'
                                                                        )}>
                                                                            {selectedDeckIds.includes(deck.id) && <Check className="w-3 h-3 text-white dark:text-zinc-900" />}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h3 className="font-medium truncate">{deck.name}</h3>
                                                                            <p className="text-xs text-muted-foreground">{deck.card_count} cards</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </ScrollArea>
                                            </TabsContent>

                                            <TabsContent value="files" className="min-h-[400px]">
                                                <div className="space-y-4">
                                                    <div
                                                        className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-zinc-400 dark:hover:border-zinc-500 transition-all duration-200 cursor-pointer hover:bg-muted/30"
                                                        onClick={() => document.getElementById('file-upload')?.click()}
                                                    >
                                                        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                                                        <p className="text-sm font-medium mb-1">Drop files here or click to upload</p>
                                                        <p className="text-xs text-muted-foreground">PDF and TXT files supported</p>
                                                        <input id="file-upload" type="file" className="hidden" multiple accept=".txt,.pdf" onChange={handleFileUpload} />
                                                    </div>

                                                    {uploadedFiles.length > 0 && (
                                                        <div className="grid gap-2">
                                                            {uploadedFiles.map((file, i) => (
                                                                <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                                        <FileText className="w-5 h-5 flex-shrink-0 text-zinc-500" />
                                                                        <span className="text-sm truncate font-medium">{file.name}</span>
                                                                    </div>
                                                                    <button onClick={() => removeFile(i)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 rounded-lg transition-colors">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TabsContent>
                                        </Tabs>

                                        <div className="mt-8 space-y-6">
                                            <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-medium">Question Marks</label>
                                                    <span className="px-3 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full text-sm font-bold">
                                                        {marks[0]}
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={marks}
                                                    onValueChange={setMarks}
                                                    min={1}
                                                    max={40}
                                                    step={1}
                                                    className="py-4"
                                                />
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>1</span><span>10</span><span>20</span><span>30</span><span>40</span>
                                                </div>
                                            </div>

                                            <Button
                                                size="lg"
                                                className="w-full font-semibold text-lg h-14 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                                                onClick={generateQuestion}
                                                disabled={isGenerating || totalSelected === 0}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        Generating Question...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="mr-2 h-5 w-5" />
                                                        Generate Question
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Step 3: Result */}
                            <div className={cn(
                                "transition-all duration-500 ease-out",
                                step === 'result' ? "opacity-100 scale-100" : "opacity-0 scale-95 absolute pointer-events-none"
                            )}>
                                {step === 'result' && generatedQuestion && (
                                    <div className="max-w-3xl mx-auto">
                                        <Card className="border-2 border-zinc-200 dark:border-zinc-700 shadow-2xl bg-card/80 backdrop-blur-sm overflow-hidden">
                                            <div className="h-1 bg-gradient-to-r from-zinc-400 via-zinc-600 to-zinc-400" />
                                            <CardContent className="p-8 md:p-12">
                                                <div className="flex justify-between items-start mb-8">
                                                    <span className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-full">
                                                        {selectedSubject?.name} • {marks[0]} marks
                                                    </span>
                                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                                </div>

                                                <h2 className="text-2xl md:text-3xl font-medium leading-relaxed mb-12">
                                                    {generatedQuestion}
                                                </h2>

                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <Button size="lg" className="flex-1 text-lg h-14 group shadow-lg hover:shadow-xl transition-all duration-300" onClick={goToEssay}>
                                                        Write Essay Answer
                                                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                    </Button>
                                                    <Button variant="outline" size="lg" className="flex-1 text-lg h-14 hover:bg-muted/50" onClick={() => setStep('sources')}>
                                                        <Sparkles className="mr-2 w-5 h-5" />
                                                        Try Another
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

