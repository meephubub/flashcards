"use client"

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2, Send, Bot, User, Sparkles, ChevronDown, ChevronUp, Zap } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface ToolEvent {
    type: "tool_call" | "tool_result"
    tool: string
    args?: string
    result?: string
    id: string
}

interface Message {
    role: "user" | "assistant"
    content: string
    toolEvents?: ToolEvent[]
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState("")
    const [streamingToolEvents, setStreamingToolEvents] = useState<ToolEvent[]>([])
    const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, streamingContent])

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto"
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px"
        }
    }, [input])

    const toggleToolExpand = (index: number) => {
        setExpandedTools((prev) => {
            const next = new Set(prev)
            if (next.has(index)) {
                next.delete(index)
            } else {
                next.add(index)
            }
            return next
        })
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e as unknown as FormEvent)
        }
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userMessage: Message = { role: "user", content: input.trim() }
        setMessages((prev) => [...prev, userMessage])
        setInput("")
        setIsLoading(true)
        setStreamingContent("")
        setStreamingToolEvents([])

        try {
            const history = messages.map((m) => ({ role: m.role, content: m.content }))

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: userMessage.content,
                    history,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to get response")
            }

            if (!response.body) {
                throw new Error("No response body")
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let fullContent = ""
            const collectedToolEvents: ToolEvent[] = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (!line.trim()) continue
                    try {
                        const event = JSON.parse(line)

                        if (event.type === "tool_call") {
                            const toolEvent: ToolEvent = {
                                type: "tool_call",
                                tool: event.tool,
                                args: event.args,
                                id: event.id,
                            }
                            collectedToolEvents.push(toolEvent)
                            setStreamingToolEvents([...collectedToolEvents])
                        } else if (event.type === "tool_result") {
                            const idx = collectedToolEvents.findIndex(
                                (e) => e.id === event.id && e.type === "tool_call"
                            )
                            if (idx !== -1) {
                                collectedToolEvents[idx] = {
                                    ...collectedToolEvents[idx],
                                    type: "tool_result",
                                    result: event.result,
                                }
                                setStreamingToolEvents([...collectedToolEvents])
                            }
                        } else if (event.type === "chunk") {
                            fullContent += event.content || ""
                            setStreamingContent(fullContent)
                        } else if (event.type === "final") {
                            fullContent = event.content || fullContent
                            setStreamingContent(fullContent)
                        } else if (event.type === "error") {
                            console.error("Stream error:", event.error)
                            fullContent = `Error: ${event.error}`
                            setStreamingContent(fullContent)
                        }
                    } catch (err) {
                        console.error("Failed to parse stream line:", line, err)
                    }
                }
            }

            // Finalize message
            const assistantMessage: Message = {
                role: "assistant",
                content: fullContent,
                toolEvents: collectedToolEvents.length > 0 ? collectedToolEvents : undefined,
            }
            setMessages((prev) => [...prev, assistantMessage])
        } catch (error) {
            console.error("Chat error:", error)
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, an error occurred. Please try again." },
            ])
        } finally {
            setIsLoading(false)
            setStreamingContent("")
            setStreamingToolEvents([])
        }
    }

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
            {/* Header */}
            <header className="border-b border-zinc-800/50 backdrop-blur-xl bg-zinc-950/80 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4 max-w-4xl mx-auto">
                    <div className="relative">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-xl shadow-black/20">
                            <Sparkles className="h-6 w-6 text-zinc-200" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-50 tracking-tight">Assistant</h1>
                        <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                            <Zap className="h-3 w-3" />
                            Powered by Groq
                        </p>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                <div className="max-w-4xl mx-auto py-8 space-y-8">
                    <AnimatePresence>
                        {messages.length === 0 && !isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center justify-center h-[50vh] text-center"
                            >
                                <div className="relative mb-6">
                                    <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center shadow-2xl shadow-black/40">
                                        <Bot className="h-12 w-12 text-zinc-400" />
                                    </div>
                                    <div className="absolute -inset-4 bg-gradient-to-r from-zinc-800/20 via-transparent to-zinc-800/20 rounded-full blur-2xl" />
                                </div>
                                <h2 className="text-2xl font-medium text-zinc-200 mb-3">How can I help you today?</h2>
                                <p className="text-zinc-500 max-w-md leading-relaxed">
                                    I can help with calculations, search the web, look up Wikipedia articles, and more.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {messages.map((message, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                                "flex gap-4",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === "assistant" && (
                                <Avatar className="h-9 w-9 shrink-0 ring-2 ring-zinc-800">
                                    <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-zinc-300">
                                        <Bot className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                            )}

                            <div
                                className={cn(
                                    "max-w-[75%] space-y-3",
                                    message.role === "user" ? "order-first" : ""
                                )}
                            >
                                {/* Tool Events */}
                                {message.toolEvents && message.toolEvents.length > 0 && (
                                    <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-4 shadow-lg">
                                        <button
                                            onClick={() => toggleToolExpand(index)}
                                            className="flex items-center justify-between w-full text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Zap className="h-4 w-4 text-amber-500" />
                                                {message.toolEvents.length} tool{message.toolEvents.length > 1 ? "s" : ""} used
                                            </span>
                                            {expandedTools.has(index) ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </button>
                                        <AnimatePresence>
                                            {expandedTools.has(index) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                                                        {message.toolEvents.map((event, eventIdx) => (
                                                            <div key={eventIdx} className="text-xs space-y-2">
                                                                <div className="text-zinc-300 font-medium flex items-center gap-2">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                    {event.tool}
                                                                </div>
                                                                {event.args && (
                                                                    <pre className="bg-zinc-950/80 rounded-lg p-3 text-zinc-500 overflow-x-auto font-mono text-[11px]">
                                                                        {event.args}
                                                                    </pre>
                                                                )}
                                                                {event.result && (
                                                                    <pre className="bg-zinc-950/80 rounded-lg p-3 text-emerald-400/90 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
                                                                        {event.result}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Message Content */}
                                <div
                                    className={cn(
                                        "rounded-2xl px-5 py-4 shadow-lg",
                                        message.role === "user"
                                            ? "bg-zinc-100 text-zinc-900"
                                            : "bg-zinc-900/80 backdrop-blur text-zinc-100 border border-zinc-800/50"
                                    )}
                                >
                                    {message.role === "assistant" ? (
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-2 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-relaxed">{message.content}</p>
                                    )}
                                </div>
                            </div>

                            {message.role === "user" && (
                                <Avatar className="h-9 w-9 shrink-0 ring-2 ring-zinc-200">
                                    <AvatarFallback className="bg-zinc-100 text-zinc-900">
                                        <User className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                            )}
                        </motion.div>
                    ))}

                    {/* Streaming State */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex gap-4 justify-start"
                            >
                                <Avatar className="h-9 w-9 shrink-0 ring-2 ring-zinc-800">
                                    <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-zinc-300">
                                        <Bot className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="max-w-[75%] space-y-3">
                                    {/* Streaming Tool Events */}
                                    {streamingToolEvents.length > 0 && (
                                        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-4 shadow-lg">
                                            <div className="text-sm text-zinc-400 mb-3 flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Processing...
                                            </div>
                                            <div className="space-y-2">
                                                {streamingToolEvents.map((event, idx) => (
                                                    <div key={idx} className="text-xs flex items-center gap-2">
                                                        <span className={cn(
                                                            "h-2 w-2 rounded-full",
                                                            event.result ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                                                        )} />
                                                        <span className="text-zinc-300">{event.tool}</span>
                                                        {event.result && (
                                                            <span className="text-emerald-400/80">✓</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Streaming Content */}
                                    <div className="rounded-2xl px-5 py-4 bg-zinc-900/80 backdrop-blur text-zinc-100 border border-zinc-800/50 shadow-lg">
                                        {streamingContent ? (
                                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                                                <ReactMarkdown>{streamingContent}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 text-zinc-500">
                                                <div className="flex gap-1">
                                                    <span className="h-2 w-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                    <span className="h-2 w-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                    <span className="h-2 w-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                                </div>
                                                <span className="text-sm">Thinking...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-zinc-800/50 backdrop-blur-xl bg-zinc-950/80 p-4">
                <form
                    onSubmit={handleSubmit}
                    className="max-w-4xl mx-auto"
                >
                    <div className="flex items-end gap-3 bg-zinc-900/80 backdrop-blur rounded-2xl border border-zinc-800/50 p-2 shadow-xl shadow-black/20">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message Assistant..."
                            disabled={isLoading}
                            rows={1}
                            className="flex-1 bg-transparent border-none text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-0 resize-none px-3 py-2 text-sm leading-relaxed max-h-[200px]"
                        />
                        <Button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            size="icon"
                            className="h-10 w-10 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-zinc-100 transition-all shadow-lg"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-center text-xs text-zinc-600 mt-3">
                        Press Enter to send, Shift+Enter for new line
                    </p>
                </form>
            </div>
        </div>
    )
}
