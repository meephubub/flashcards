"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { usePorcupine } from "@picovoice/porcupine-react"
import { useToast } from "@/hooks/use-toast"
import SpeechToTextModal from "@/components/speech/speech-to-text-modal"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Plus, MessageSquare, UserCircle, Sparkles, Trash2, Sun, Moon, PanelLeft } from "lucide-react"
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
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

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

// 1. Add ToolEvent type
type ToolEvent = {
  tool: string;
  args?: string;
  id?: string;
  result?: string;
};

type Message = {
  role: "user" | "assistant"
  content: string
  created_at: string
  toolEvents?: ToolEvent[]
  responseTime?: number; // Time in milliseconds
}

type AgentConversation = {
  id: string
  title: string | null
  created_at: string
  messages: Message[]
}

// Add a type for streaming events
interface StreamingEvent {
  type: 'tool_call' | 'tool_result' | 'final' | 'error';
  tool?: string;
  args?: string;
  id?: string;
  result?: string;
  content?: string;
  error?: string;
}

// Helper to generate a unique session_id (UUID)
function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  return Math.random().toString(36).slice(2) + Date.now()
}

// ChatInputBar component
function ChatInputBar({
  input,
  setInput,
  isSending,
  handleSend,
  selectedModel,
  setSelectedModel,
  modelOptions,
  theme,
  isEditing,
  setIsEditing,
}: {
  input: string,
  setInput: (v: string) => void,
  isSending: boolean,
  handleSend: (e: React.FormEvent) => void,
  selectedModel: string,
  setSelectedModel: (v: string) => void,
  modelOptions: { label: string, value: string }[],
  theme: any,
  isEditing: boolean,
  setIsEditing: (v: boolean) => void,
}) {
  // Handle Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && input.trim()) {
        // Create a fake event to pass to handleSend
        handleSend({ preventDefault: () => {} } as any);
      }
    }
  };
  return (
    <div className="relative w-full flex justify-center mt-4">
      <div className="w-[90%] max-w-3xl mx-auto pointer-events-auto pb-10">
        <form onSubmit={handleSend} className={`flex items-center gap-2 rounded-3xl ${theme.bg} ${theme.border} border px-4 py-2 w-full shadow-lg`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={`h-10 px-2 rounded-full ${theme.bgSecondary} ${theme.text} border ${theme.border} transition-colors`} style={{ background: 'inherit' }}>
                {modelOptions.find((m) => m.value === selectedModel)?.label || selectedModel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={`${theme.bg} ${theme.text} border ${theme.border}`}> 
              <DropdownMenuLabel className={theme.text}>Select Model</DropdownMenuLabel>
              <DropdownMenuSeparator className={theme.border} />
              <DropdownMenuRadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                {modelOptions.map((model) => (
                  <DropdownMenuRadioItem key={model.value} value={model.value} className={`${theme.bg} ${theme.text} hover:${theme.bgHover}`}>
                    {model.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isEditing ? "Edit your message..." : "Ask anything"}
            disabled={isSending}
            rows={1}
            className={`flex-1 bg-transparent border-none outline-none text-base px-2 py-3 focus:ring-0 placeholder:${theme.textMuted} resize-none overflow-auto min-h-[48px] max-h-40 ${theme.text}`}
            style={{ minWidth: 0 }}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
            onKeyDown={handleKeyDown}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSending || !input.trim()}
            className={`h-10 w-10 rounded-full ${theme.bgSecondary} hover:${theme.bgHover} ${theme.text} shadow-none border-none flex items-center justify-center`}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}

// New ToolEventsDropdown component
function ToolEventsDropdown({
  toolEvents,
  theme,
  currentTheme,
  responseTime,
}: {
  toolEvents: ToolEvent[] | undefined; // Allow undefined
  theme: any;
  currentTheme: string;
  responseTime?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolEvents || toolEvents.length === 0) return null;

  return (
    <div className={`mt-4 w-full px-4 py-3 rounded-lg ${theme.bgSecondary} border ${theme.border} overflow-hidden`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`font-medium ${theme.textSecondary}`}>
          Tools Used ({toolEvents.length})
        </span>
        <div className="flex items-center gap-2">
          {responseTime !== undefined && (
            <span className={`text-xs ${theme.textMuted}`}>{responseTime} ms</span>
          )}
          <svg
            className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""} ${theme.textSecondary}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.borderHover }}>
          {toolEvents.map((ev, i) => (
            <div key={ev.id || i} className="mb-4 last:mb-0 p-3 rounded-md bg-opacity-10" style={{ backgroundColor: theme.bgHover }}>
              <div className={`font-semibold ${theme.text}`}>Tool: {ev.tool}</div>
              {ev.args && (
                <div className={`text-sm ${theme.textMuted} mt-1`}>
                  Args: <code className={`font-mono ${theme.textFaint} text-xs block p-2 rounded ${theme.bgSelected}`}>{ev.args}</code>
                </div>
              )}
              <div className={`text-sm ${theme.textMuted} mt-2`}>Result:</div>
              <div className={`bg-neutral-800 text-sm text-green-300 p-2 rounded font-mono whitespace-pre-wrap overflow-x-auto`} style={{ backgroundColor: currentTheme === 'dark' ? '#262626' : '#e5e5e5', color: currentTheme === 'dark' ? '#86efac' : '#16a34a' }}>
                {ev.result}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { getOrLoadModel } from '@/lib/modelManager';

export default function ChatPage() {
  const { toast } = useToast();

  useEffect(() => {
    const preloadModel = async () => {
      try {
        let downloadStarted = false;
        await getOrLoadModel({
          onDownloadStart: () => {
            if (!downloadStarted) {
              downloadStarted = true;
              toast({
                title: 'Downloading speech model',
                description: 'This may take up to a minute the first time.',
                duration: 5000,
              });
            }
          }
        });
        toast({
          title: 'Speech model ready',
          description: 'You can now use voice commands',
          duration: 3000,
        });
      } catch (error) {
        console.error('Failed to load model:', error);
        toast({
          title: 'Error',
          description: 'Failed to load speech model',
          variant: 'destructive',
        });
      }
    };
    preloadModel();
  }, [toast]);
  const { keywordDetection, isLoaded, isListening, error, init, start, release } = usePorcupine();

  // Only initialize Porcupine once and only start after loaded
  useEffect(() => {
    let cancelled = false;
    const runPorcupine = async () => {
      try {
        const porcupineKeyword = {
          publicPath: "/models/hey-sam_en_wasm_v3_0_0.ppn",
          label: "Hey Sam"
        };
        const porcupineModel = {
          publicPath: "/models/porcupine_params.pv"
        };
        console.log("[Porcupine] Initializing with access key:", process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY);
        await init(
          process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY!,
          porcupineKeyword,
          porcupineModel
        );
        console.log("[Porcupine] Initialization successful.");
      } catch (e) {
        if (!cancelled) {
          console.error("[Porcupine] Initialization error:", e);
          toast({
            title: "Porcupine Error",
            description: (e as Error).message || String(e),
            variant: "destructive",
            duration: 4000,
          });
        }
      }
    };
    if (process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY) {
      runPorcupine();
    }
    return () => {
      cancelled = true;
      console.log("[Porcupine] Releasing resources and stopping detection.");
      release?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start listening only after loaded
  useEffect(() => {
    if (isLoaded && !isListening) {
      start().then(() => {
        console.log("[Porcupine] Listening for wake word 'Hey Sam'...");
      }).catch(e => {
        console.error("[Porcupine] Start error:", e);
        toast({
          title: "Porcupine Start Error",
          description: (e as Error).message || String(e),
          variant: "destructive",
          duration: 4000,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  useEffect(() => {
    if (keywordDetection !== null && isLoaded && isListening) {
      console.log("[Porcupine] Wake word detected!", keywordDetection);
      setIsSttModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordDetection]);

  useEffect(() => {
    if (error) {
      console.error("[Porcupine] Error:", error);
      toast({
        title: "Porcupine Error",
        description: error.message,
        variant: "destructive",
        duration: 4000,
      });
    }
  }, [error, toast]);
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT;
  const usingDevAuthBypass = environment === "dev";
  const { user: realUser, isLoading: authLoading } = useAuth();
  // If in dev mode, mock a user object
  const user = usingDevAuthBypass
    ? {
        id: "dev-user-id",
        email: "dev@localhost",
        name: "Dev User",
      }
    : realUser;
  const [convos, setConvos] = useState<AgentConversation[]>([])
  const [selectedConvo, setSelectedConvo] = useState<AgentConversation | null>(null)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isSttModalOpen, setIsSttModalOpen] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState("")
  const [streamingEvents, setStreamingEvents] = useState<StreamingEvent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // State for editing messages
  const [isEditing, setIsEditing] = useState(false)
  const [editedMessageId, setEditedMessageId] = useState<string | null>(null)

  // Model selection
  const [selectedModel, setSelectedModel] = useState("gpt-4o")
  const modelOptions = [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
    { label: "Agent Large", value: "agent-large", model: "openai", baseURL: "https://text.pollinations.ai/openai/" },
    { label: "Agent Small", value: "agent-small", model: "llama-3.3-70b-versatile", baseURL: "https://api.groq.com/openai/v1" },
  ]

  // Theme management
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("light") // Default to light
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

  // Handle editing a message
  const handleEditMessage = (messageToEdit: Message) => {
    setInput(messageToEdit.content);
    setEditedMessageId(messageToEdit.created_at);
    setIsEditing(true);
    // Scroll to the input area
    window.scrollTo({ behavior: "smooth", top: document.body.scrollHeight });
  };

  // Send message and stream response
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !user) return

    const startTime = Date.now(); // Record start time

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
    setStreamingEvents([])

    let messagesForApi = [];
    let messagesToUpdateState = [];

    if (isEditing && editedMessageId) {
      // If editing, find and update the existing message
      messagesToUpdateState = convo.messages.map(msg =>
        msg.created_at === editedMessageId ? { ...msg, content: userMsg.content } : msg
      );
      setIsEditing(false);
      setEditedMessageId(null);
    } else {
      // Otherwise, add new user message locally
      messagesToUpdateState = [...convo.messages, userMsg];
    }
    setSelectedConvo({ ...convo, messages: messagesToUpdateState });

    // Prepare messages for API (always use the potentially updated history)
    const history = messagesToUpdateState.map((m) => ({ role: m.role, content: m.content }))
    // Stream from API
    let response;
    // Determine the API endpoint and model to use
    const selectedModelOption = modelOptions.find(option => option.value === selectedModel);
    const apiEndpoint = selectedModelOption?.baseURL || "https://text.pollinations.ai/";
    const apiModel = selectedModelOption?.model || selectedModel;

    if (selectedModel === "agent-large" || selectedModel === "agent-small") {
      console.log("Calling agent API with:", { prompt: input.trim(), history, stream: true, model: apiModel, baseURL: apiEndpoint });
      response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input.trim(), history, stream: true, model: apiModel, baseURL: apiEndpoint }),
      });
      console.log("Agent API response status:", response.status);
      if (!response.ok) {
        console.error("Agent API error:", response.statusText);
        setIsSending(false)
        return
      }
      if (!response.body) {
        console.error("No response body from agent API");
        setIsSending(false)
        return
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullMsg = "";
      // This array will reliably collect all raw events from the stream
      const rawStreamEvents: StreamingEvent[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          //console.log("Parsing line:", line);
          try {
            const event: StreamingEvent = JSON.parse(line);
            //console.log("Parsed event:", event);
            console.log("[AGENT-STREAM]", event); // Keep this log for debugging

            rawStreamEvents.push(event); // Collect all raw events

            if (event.type === "tool_call") {
              // Update streamingEvents for immediate UI display
              setStreamingEvents(prev => [...prev, event]);
            } else if (event.type === "tool_result") {
              // Update streamingEvents to replace tool_call with result for immediate UI display
              setStreamingEvents(prev =>
                prev.map(e => (e.type === "tool_call" && e.id === event.id ? { ...event, type: "tool_result" } : e))
              );
            } else if (event.type === "final") {
              fullMsg += event.content || "";
              setStreamingMsg(fullMsg);
            } else if (event.type === "error") {
              setStreamingMsg(event.error || "Error");
              console.error("Error event:", event.error);
            }
          } catch (err) {
            console.error("Failed to parse stream line:", line, err);
          }
        }
      }

      // After the stream is fully received, process all raw events to build toolEventsToStore
      console.log("Raw events collected after stream completion:", rawStreamEvents);
      const toolEventsToStore: ToolEvent[] = [];
      const calls = rawStreamEvents.filter(ev => ev.type === "tool_call");
      const results = rawStreamEvents.filter(ev => ev.type === "tool_result");

      for (const call of calls) {
        const result = results.find(r => r.id === call.id);
        if (result) { // Only store if there's a corresponding result
          toolEventsToStore.push({
            tool: call.tool || '',
            args: typeof call.args === 'object' && call.args !== null
                  ? JSON.stringify(call.args, null, 2)
                  : call.args,
            id: call.id,
            result: result.result,
          });
        }
      }

      const endTime = Date.now(); // Record end time
      const responseTime = endTime - startTime; // Calculate time taken

      setIsSending(false);
      setStreamingMsg(""); // Clear streaming message as final message is about to be added
      setStreamingEvents([]); // Clear streaming tool events

      const assistantMsg: Message = {
        role: "assistant",
        content: fullMsg,
        created_at: new Date().toISOString(),
        toolEvents: toolEventsToStore.length > 0 ? toolEventsToStore : undefined,
        responseTime: responseTime, // Make sure responseTime is passed here
      };
      console.log("Final Assistant message to store:", assistantMsg);

      const finalMessagesToStore = [...messagesToUpdateState, assistantMsg];
      await supabase.from("agent_conversations").update({ messages: finalMessagesToStore }).eq("id", convo.id);
      setSelectedConvo({ ...convo, messages: finalMessagesToStore });
      setConvos((prev) => prev.map((c) => (c.id === convo.id ? { ...c, messages: finalMessagesToStore } : c)));
      return;
    } else {
      // Existing streaming logic for other models
      const endTime = Date.now(); // Record end time
      const responseTime = endTime - startTime; // Calculate time taken
      response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: apiModel, messages: history, stream: true }),
      });
      if (!response.body) {
        setIsSending(false)
        return
      }
      const reader = response.body.getReader();
      let buffer = "";
      const decoder = new TextDecoder();
      let fullMsg = "";
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
      setIsSending(false)
      setStreamingMsg("")
      const assistantMsg: Message = {
        role: "assistant",
        content: fullMsg,
        created_at: new Date().toISOString(),
        responseTime: responseTime,
      }
      const finalMessages = [...messagesToUpdateState, assistantMsg]
      // Save both user and assistant messages to Supabase
      await supabase.from("agent_conversations").update({ messages: finalMessages }).eq("id", convo.id)
      // Update local state
      setSelectedConvo({ ...convo, messages: finalMessages })
      setConvos((prev) => prev.map((c) => (c.id === convo.id ? { ...c, messages: finalMessages } : c)))
    }
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

  if (!user && !usingDevAuthBypass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <MessageSquare className="w-10 h-10 mb-4 text-gray-400" />
        <h2 className="text-2xl font-semibold mb-2">Welcome to AI Chat</h2>
        <p className="text-gray-500 mb-4">Please sign in to start chatting.</p>
        <Button onClick={() => window.location.href = "/"}>
          Go to Home
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex h-screen ${theme.bg} ${theme.text}`}>
      {/* Sidebar: Chat list */}
      <aside className={`w-80 ${theme.border} border-r ${theme.bg} flex-col hidden sm:flex`}>
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
        <SpeechToTextModal
          isOpen={isSttModalOpen}
          onClose={() => setIsSttModalOpen(false)}
          onTranscript={(transcript) => {
            setInput(transcript);
            setIsSttModalOpen(false);
          }}
        />
        {/* Header */}
        <header className={`${theme.border} border-b ${theme.bg}/50 backdrop-blur-sm`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${theme.bgHover} ${theme.borderHover} border`}
                    >
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className={`p-0 ${theme.bg} ${theme.text} w-80`}>
                    <aside className={`w-full h-full ${theme.bg} flex flex-col`}>
                      <div className={`p-6 ${theme.border} border-b`}>
                        <div className="flex items-center justify-between mb-4">
                          <SheetHeader>
                            <SheetTitle>Conversations</SheetTitle>
                          </SheetHeader>
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
                                <SheetClose asChild key={convo.id}>
                                  <div
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
                                </SheetClose>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </aside>
                  </SheetContent>
                </Sheet>
              )}
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
            <div className="flex flex-col justify-center items-center h-full px-4 sm:px-6">
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
                  <ChatInputBar
                    input={input}
                    setInput={setInput}
                    isSending={isSending}
                    handleSend={handleSend}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    modelOptions={modelOptions}
                    theme={theme}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto px-4 py-6 sm:px-6">
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
                        <button
                          className={`ml-2 p-1 rounded hover:${theme.bgHover} ${theme.textMuted} hover:${theme.text}`}
                          title="Edit message"
                          onClick={() => handleEditMessage(msg)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                        </button>
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
                          {/* Tool events dropdown */}
                          <ToolEventsDropdown toolEvents={msg.toolEvents} theme={theme} currentTheme={currentTheme} responseTime={msg.responseTime} />
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
                        <div className="flex items-center gap-2 text-left ml-10">
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
              <ChatInputBar
                input={input}
                setInput={setInput}
                isSending={isSending}
                handleSend={handleSend}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                modelOptions={modelOptions}
                theme={theme}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
