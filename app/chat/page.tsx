"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Plus, MessageSquare, UserCircle, Sparkles, Trash2, Sun, Moon } from "lucide-react"
import ReactMarkdown from "react-markdown"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

// Theme definitions
const themes = {
  dark: {
    bg: "bg-black",
    text: "text-white",
    textSecondary: "text-white/70",
    textMuted: "text-white/50",
    textFaint: "text-white/30",
    border: "border-white/10",
    borderHover: "border-white/20",
    bgSecondary: "bg-white/5",
    bgHover: "bg-white/10",
    bgSelected: "bg-neutral-800", // softer grey for selected chat
    textSelected: "text-white",
    textSelectedSecondary: "text-white/60",
    textSelectedMuted: "text-white/40",
    button: "bg-white text-black hover:bg-white/90",
    buttonSecondary: "bg-white/10 text-white hover:bg-white/20",
    input: "bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-white/40",
    message: {
      user: "bg-neutral-800 text-white", // softer grey for user bubble
      assistant: "bg-white/10 text-white border-white/10",
    },
  },
  light: {
    bg: "bg-white",
    text: "text-black",
    textSecondary: "text-black/70",
    textMuted: "text-black/50",
    textFaint: "text-black/30",
    border: "border-black/10",
    borderHover: "border-black/20",
    bgSecondary: "bg-black/5",
    bgHover: "bg-black/10",
    bgSelected: "bg-neutral-200", // softer grey for selected chat
    textSelected: "text-black",
    textSelectedSecondary: "text-black/60",
    textSelectedMuted: "text-black/40",
    button: "bg-black text-white hover:bg-black/90",
    buttonSecondary: "bg-black/10 text-black hover:bg-black/20",
    input: "bg-black/5 border-black/20 text-black placeholder:text-black/40 focus:border-black/40",
    message: {
      user: "bg-neutral-200 text-black", // softer grey for user bubble
      assistant: "bg-black/10 text-black border-black/10",
    },
  },
}

type Message = {
  role: "user" | "assistant"
  content: string
  created_at: string
}

type AgentConversation = {
  id: string
  title: string | null
  created_at: string
  messages: Message[]
}

// Helper to generate a unique session_id (UUID)
function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  return Math.random().toString(36).slice(2) + Date.now()
}

export default function ChatPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [convos, setConvos] = useState<AgentConversation[]>([])
  const [selectedConvo, setSelectedConvo] = useState<AgentConversation | null>(null)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Model selection
  const [selectedModel, setSelectedModel] = useState("gpt-4o")
  const modelOptions = [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
    { label: "Agent", value: "agent" },
  ]

  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("dark")
  const theme = themes[currentTheme]

  const toggleTheme = () => {
    setCurrentTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  // Load user's conversations
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select("id, title, created_at, messages")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (!error && data) setConvos(data.map((c: any) => ({ ...c, messages: c.messages || [] })))
    })()
  }, [user])

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedConvo, streamingMsg])

  // Start a new conversation
  const handleNewChat = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("agent_conversations")
      .insert({ user_id: user.id, title: "New Chat", messages: [], session_id: generateSessionId() })
      .select()
      .single()
    if (!error && data) {
      const newConvo = { ...data, messages: [] }
      setConvos((prev) => [newConvo, ...prev])
      setSelectedConvo(newConvo)
    }
  }

  // Send message and stream response
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !user) return

    // If no chat is selected, create a new one first
    let convo = selectedConvo
    if (!convo) {
      const { data, error } = await supabase
        .from("agent_conversations")
        .insert({ user_id: user.id, title: "New Chat", messages: [], session_id: generateSessionId() })
        .select()
        .single()
      if (error || !data) {
        setIsSending(false)
        return
      }
      convo = { ...data, messages: [] }
      setConvos((prev) => [convo!, ...prev])
      setSelectedConvo(convo!)
    }

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    }
    setInput("")
    setIsSending(true)
    setStreamingMsg("")
    // Add user message locally
    const updatedMessages = [...convo.messages, userMsg]
    setSelectedConvo({ ...convo, messages: updatedMessages })
    // Prepare messages for API
    const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }))
    // Stream from API
    let response;
    if (selectedModel === "agent") {
      response = await fetch("https://flashcards-api-1.onrender.com/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input.trim() }),
      });
    } else {
      response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: history, stream: true }),
      });
    }
    if (!response.body) {
      setIsSending(false)
      return
    }
    let fullMsg = "";
    if (selectedModel === "agent") {
      // Stream plain text response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullMsg += chunk;
        setStreamingMsg(fullMsg);
      }
    } else {
      const reader = response.body.getReader();
      let buffer = "";
      const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line for next chunk
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                fullMsg += delta.content;
                setStreamingMsg(fullMsg);
              }
            } catch (e) {
              // ignore malformed lines
            }
          }
        }
      }
    }
    setIsSending(false)
    setStreamingMsg("")
    const assistantMsg: Message = {
      role: "assistant",
      content: fullMsg,
      created_at: new Date().toISOString(),
    }
    const finalMessages = [...updatedMessages, assistantMsg]
    // Save both user and assistant messages to Supabase
    await supabase.from("agent_conversations").update({ messages: finalMessages }).eq("id", convo.id)
    // Update local state
    setSelectedConvo({ ...convo, messages: finalMessages })
    setConvos((prev) => prev.map((c) => (c.id === convo.id ? { ...c, messages: finalMessages } : c)))
  }

  // Delete a conversation
  const handleDeleteConvo = async (convoId: string) => {
    await supabase.from("agent_conversations").delete().eq("id", convoId)
    setConvos((prev) => prev.filter((c) => c.id !== convoId))
    if (selectedConvo?.id === convoId) {
      setSelectedConvo(null)
    }
  }

  if (authLoading) {
    return (
      <div className={`flex justify-center items-center h-screen ${theme.bg}`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={`animate-spin h-8 w-8 ${theme.text}`} />
          <p className={`${theme.textSecondary} text-sm`}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen ${theme.bg} ${theme.text}`}>
        <div className="text-center space-y-4">
          <UserCircle className={`h-16 w-16 mx-auto ${theme.textMuted}`} />
          <h1 className="text-2xl font-bold">Welcome to AI Chat</h1>
          <p className={theme.textSecondary}>Please sign in to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-screen ${theme.bg} ${theme.text}`}>
      {/* Sidebar: Chat list */}
      <aside className={`w-80 ${theme.border} border-r ${theme.bg} flex flex-col`}>
        <div className={`p-6 ${theme.border} border-b`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 ${currentTheme === "dark" ? "bg-white" : "bg-black"} rounded-lg flex items-center justify-center`}
              >
                <MessageSquare className={`h-4 w-4 ${currentTheme === "dark" ? "text-black" : "text-white"}`} />
              </div>
              <span className="font-semibold text-lg">Conversations</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNewChat}
              className={`h-8 w-8 ${theme.bgHover} ${theme.borderHover} border`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {convos.length === 0 ? (
            <div className="p-6 text-center">
              <div
                className={`w-12 h-12 ${theme.bgSecondary} rounded-full flex items-center justify-center mx-auto mb-3`}
              >
                <MessageSquare className={`h-6 w-6 ${theme.textFaint}`} />
              </div>
              <p className={`${theme.textMuted} text-sm`}>No conversations yet</p>
              <p className={`${theme.textFaint} text-xs mt-1`}>Start a new chat to begin</p>
            </div>
          ) : (
            <div className="p-2">
              {convos.map((convo) => {
                const lastMsg = convo.messages[convo.messages.length - 1]?.content || ""
                const isSelected = selectedConvo?.id === convo.id
                return (
                  <div
                    key={convo.id}
                    className={`p-4 cursor-pointer rounded-lg mb-2 transition-all duration-200 group ${
                      isSelected
                        ? `${theme.bgSelected} ${theme.textSelected}`
                        : `hover:${theme.bgSecondary} ${theme.border} border border-transparent hover:${theme.borderHover}`
                    }`}
                    onClick={() => setSelectedConvo(convo)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium truncate ${isSelected ? theme.textSelected : theme.text}`}>
                        {convo.title || "New Chat"}
                      </span>
                      <div className="flex items-center gap-2">
                      {isSelected && (
                        <div className={`w-2 h-2 ${currentTheme === "dark" ? "bg-black" : "bg-white"} rounded-full`} />
                      )}
                        <button
                          className={`ml-2 p-1 rounded hover:${theme.bgHover} ${theme.textMuted} hover:${theme.text}`}
                          title="Delete chat"
                          onClick={e => { e.stopPropagation(); handleDeleteConvo(convo.id) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className={`text-xs truncate ${isSelected ? theme.textSelectedSecondary : theme.textMuted}`}>
                      {lastMsg || "No messages yet"}
                    </p>
                    <p className={`text-xs mt-1 ${isSelected ? theme.textSelectedMuted : theme.textFaint}`}>
                      {new Date(convo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col h-full">
        {/* Header */}
        <header className={`${theme.border} border-b ${theme.bg}/50 backdrop-blur-sm`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${theme.bgHover} rounded-full flex items-center justify-center`}>
                <Sparkles className={`h-4 w-4 ${theme.text}`} />
              </div>
              <div>
                <h1 className="font-semibold text-lg">{selectedConvo?.title || "AI Assistant"}</h1>
                <p className={`${theme.textMuted} text-xs`}>
                  {selectedConvo ? `${selectedConvo.messages.length} messages` : "Ready to help"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleTheme}
                className={`${theme.bgHover} ${theme.borderHover} border`}
                title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} theme`}
              >
                {currentTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNewChat}
                className={`${theme.bgHover} ${theme.borderHover} border`}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-auto">
          {!selectedConvo ? (
            <div className="flex flex-col justify-center items-center h-full px-6">
              <div className="max-w-2xl w-full text-center space-y-8">
                <div className="space-y-4">
                  <div
                    className={`w-16 h-16 ${currentTheme === "dark" ? "bg-white" : "bg-black"} rounded-2xl flex items-center justify-center mx-auto`}
                  >
                    <Sparkles className={`h-8 w-8 ${currentTheme === "dark" ? "text-black" : "text-white"}`} />
                  </div>
                  <h2 className="text-3xl font-bold">Welcome to AI Chat</h2>
                  <p className={`${theme.textSecondary} text-lg`}>
                    Start a conversation with our AI assistant. Ask questions, get help, or just chat.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    "Explain quantum computing simply",
                    "Give me study tips for exams",
                    "Summarize recent AI developments",
                    "Help brainstorm project ideas",
                    "Suggest healthy meal plans",
                    "How to improve memory retention",
                  ].map((prompt, idx) => (
                    <button
                      key={idx}
                      className={`p-4 text-left rounded-xl ${theme.border} border ${theme.borderHover} hover:border ${theme.bgSecondary} hover:bg transition-all duration-200 group`}
                      onClick={() => setInput(prompt)}
                      type="button"
                    >
                      <p className={`text-sm ${theme.text} group-hover:${theme.textSecondary}`}>{prompt}</p>
                    </button>
                  ))}
                </div>

                {/* Input for new chat */}
                <div className="mt-8">
                  <form onSubmit={handleSend} className="flex gap-3">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isSending}
                      className={`flex-1 ${theme.input} focus:ring-0 rounded-xl h-12`}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isSending || !input.trim()}
                      className={`h-12 w-12 ${theme.button} rounded-xl`}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto px-6 py-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  {selectedConvo.messages.map((msg, idx) => (
                    msg.role === "user" ? (
                      <div key={idx} className="flex justify-end">
                      <div
                          className={`max-w-[80%] rounded-2xl px-6 py-4 ${theme.message.user} rounded-br-md`}
                      >
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        <div
                            className={`text-xs mt-3 ${currentTheme === "dark" ? "text-white/80" : "text-black/80"}`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={idx} className="w-full">
                        <div className="py-4">
                          <div className="prose prose-invert max-w-none text-lg font-medium text-left w-full">
                            <ReactMarkdown
                              components={{
                                img: ({node, ...props}) => (
                                  <img {...props} className="rounded-md" />
                                )
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                          <div className={`text-xs mt-3 ${theme.textMuted} text-left`}>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    )
                  ))}

                  {/* Streaming assistant message as last message */}
                  {isSending && streamingMsg && (
                    <div className="w-full">
                      <div className="py-4">
                        <div className={`prose prose-invert max-w-none text-lg font-medium text-left w-full ${theme.text}`}>
                          <ReactMarkdown
                            components={{
                              img: ({node, ...props}) => (
                                <img {...props} className="rounded-md" />
                              )
                            }}
                          >
                            {streamingMsg}
                          </ReactMarkdown>
                          <span className={`inline-block w-2 h-5 ${theme.textSecondary} animate-pulse ml-1`} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Typing indicator (only show if no streamingMsg) */}
                  {isSending && !streamingMsg && (
                    <div className="w-full">
                      <div className="py-4">
                        <div className="flex items-center gap-2 text-left">
                          <div className="flex gap-1">
                            <div className={`w-2 h-2 ${theme.textSecondary} rounded-full animate-bounce [animation-delay:-.32s]`} />
                            <div className={`w-2 h-2 ${theme.textSecondary} rounded-full animate-bounce [animation-delay:-.16s]`} />
                            <div className={`w-2 h-2 ${theme.textSecondary} rounded-full animate-bounce`} />
                          </div>
                          <span className={`${theme.textSecondary} text-sm ml-2`}>AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input bar (floating, modern style) */}
              <div className="relative w-full flex justify-center mt-4">
                <div className="w-[90%] max-w-3xl mx-auto pointer-events-auto pb-10">
                  <form onSubmit={handleSend} className="flex items-center gap-2 rounded-3xl bg-white shadow-lg border border-neutral-200 px-4 py-2 w-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-10 px-2 rounded-full text-neutral-500 hover:bg-neutral-100">
                          {modelOptions.find((m) => m.value === selectedModel)?.label || selectedModel}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Select Model</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                          {modelOptions.map((model) => (
                            <DropdownMenuRadioItem key={model.value} value={model.value}>
                              {model.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <textarea
                    value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Ask anything"
                    disabled={isSending}
                      rows={1}
                      className="flex-1 bg-transparent border-none outline-none text-base px-2 py-3 focus:ring-0 placeholder:text-neutral-400 resize-none overflow-auto min-h-[48px] max-h-40"
                      style={{ minWidth: 0 }}
                      onInput={e => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !input.trim()}
                      className="h-10 w-10 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 shadow-none border-none flex items-center justify-center"
                  >
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
