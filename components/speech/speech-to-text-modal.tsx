"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Send, Loader2, Sparkles, UserCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- TYPES (adapted from app/chat/page.tsx) ---
type ToolEvent = {
  tool: string;
  args?: string;
  id?: string;
  result?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
  toolEvents?: ToolEvent[];
  responseTime?: number;
};

interface StreamingEvent {
  type: 'tool_call' | 'tool_result' | 'final' | 'error';
  tool?: string;
  args?: string;
  id?: string;
  result?: string;
  content?: string;
  error?: string;
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now();
}

// --- COMPONENT PROPS ---
interface SpeechToTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export default function SpeechToTextModal({ isOpen, onClose, theme = 'light' }: SpeechToTextModalProps) {
  // --- STATE MANAGEMENT ---
  // Core state
  const [view, setView] = useState<'recording' | 'chat'>('recording');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recording state
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(isListening);
  const [isSpeaking, setIsSpeaking] = useState(false); // Block recording while TTS is playing
  const [isVADActive, setIsVADActive] = useState(false); // For UI feedback
  const cobraRef = useRef<any>(null);
  const vadStartedRef = useRef(false);
  const voiceProcessorRef = useRef<any>(null);

  // Keep isListeningRef in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pipelineRef = useRef<any>(null);

  // Patch stopRecording to always reset VAD and listening
  // --- STOP RECORDING ---
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        // If already stopped, call transcription directly as fallback
        handleTranscription();
      }
    }
    vadStartedRef.current = false;
    setIsListening(false);
  }, []);

  // Remove any other stopRecording function definitions below (deduplicated above)
  // --- VAD HANDS-FREE ---
  useEffect(() => {
    let unsubscribed = false;
    let cobra: any = null;
    let voiceProcessor: any = null;
    let stopTimeout: NodeJS.Timeout | null = null;
    async function setupVAD() {
      if (!isOpen || isSpeaking) return;
      setIsVADActive(true);
      const { CobraWorker } = await import('@picovoice/cobra-web');
      const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor');
      const accessKey = process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY;
      if (!accessKey) {
        setError('Missing Picovoice Cobra access key');
        setIsVADActive(false);
        return;
      }
      let lastActive = Date.now();
      cobra = await CobraWorker.create(accessKey, (voiceProbability: number) => {
        console.log('[VAD] voiceProbability:', voiceProbability, 'vadStarted:', vadStartedRef.current, 'isListening:', isListeningRef.current, 'lastActive:', lastActive);
        // Start if voice detected
        if (voiceProbability > 0.7 && !vadStartedRef.current && !isListeningRef.current && !isSpeaking) {
          console.log('[VAD] Detected voice, starting recording');
          vadStartedRef.current = true;
          setIsListening(true);
          startRecording();
        }
        // Track last time voice was active
        if (vadStartedRef.current && isListeningRef.current) {
          if (voiceProbability > 0.3) {
            lastActive = Date.now();
            if (stopTimeout) {
              clearTimeout(stopTimeout);
              stopTimeout = null;
            }
          } else {
            // If we've had silence for 1.2s, stop
            if (!stopTimeout) {
              console.log('[VAD] Silence detected, setting stopTimeout');
              stopTimeout = setTimeout(() => {
                if (vadStartedRef.current && isListeningRef.current && Date.now() - lastActive >= 1200) {
                  console.log('[VAD] Stopping recording after silence');
                  stopRecording();
                  vadStartedRef.current = false;
                  setIsListening(false);
                  if (stopTimeout) {
                    clearTimeout(stopTimeout);
                    stopTimeout = null;
                  }
                }
              }, 1250);
            }
          }
        }
      });
      cobraRef.current = cobra;
      voiceProcessor = WebVoiceProcessor;
      voiceProcessorRef.current = voiceProcessor;
      await voiceProcessor.subscribe(cobra);
    }
    if (isOpen && !isSpeaking) {
      setupVAD();
    }
    return () => {
      setIsVADActive(false);
      if (voiceProcessorRef.current && cobraRef.current) {
        voiceProcessorRef.current.unsubscribe(cobraRef.current);
        cobraRef.current.release();
      }
      if (stopTimeout) clearTimeout(stopTimeout);
      vadStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSpeaking]);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingMsg, setStreamingMsg] = useState('');
  const [session_id] = useState(generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- THEME ---
  const isDark = theme === 'dark';
  const themeClasses = {
    bg: isDark ? 'bg-black' : 'bg-white',
    modalBg: isDark ? 'bg-black/90' : 'bg-white/90',
    text: isDark ? 'text-white' : 'text-black',
    textSecondary: isDark ? 'text-white/70' : 'text-black/70',
    textMuted: isDark ? 'text-white/50' : 'text-black/50',
    border: isDark ? 'border-white/10' : 'border-black/10',
    closeButton: isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black',
    input: isDark ? 'bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-white/40' : 'bg-black/5 border-black/20 text-black placeholder:text-black/40 focus:border-black/40',
    button: isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/90',
    message: {
      user: isDark ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-black',
      assistant: isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black',
    },
  };

  // --- EFFECTS ---
  // Lazy-load Whisper/Xenova only when modal is open and on client
  
  //useEffect(() => {
  //  if (!isOpen || typeof window === 'undefined') return;
  //  let cancelled = false;
  //  const loadWhisper = async () => {
  //    try {
  //      setIsLoading(true);
  //      // Lazy-load modelManager (and thus Xenova/Whisper) only on client and only when needed
  //      const { getOrLoadModel } = await import('@/lib/modelManager');
  //      const whisperModel = await getOrLoadModel();
  //      if (!cancelled) pipelineRef.current = whisperModel;
  //    } catch (err) {
  //      console.error('Failed to load Whisper model:', err);
  //      setError('Failed to load speech model.');
  //    } finally {
  //      if (!cancelled) setIsLoading(false);
  //    }
  //  };
  //  loadWhisper();
  //  return () => { cancelled = true; };
  //}, [isOpen]);



  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMsg]);

  // --- RECORDING LOGIC ---
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = handleTranscription;
      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access denied.');
      setIsListening(false);
    }
  }, []);

  // --- TRANSCRIPTION & CHAT TRANSITION ---
  const handleTranscription = async () => {
    try {
      setIsLoading(true);
      // Try to use audio/wav. If not available, fallback to webm.
      let audioBlob: Blob;
      let audioFormat: string;
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/wav')) {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        audioFormat = 'wav';
      } else {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioFormat = 'webm';
      }
      console.log('Audio blob:', audioBlob.type, audioBlob.size);
      // Send to local API route for Groq STT
      const formData = new FormData();
      formData.append('file', audioBlob, `audio.${audioFormat}`);
      formData.append('format', audioFormat);
      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq STT API error:', response.status, errorText);
        throw new Error('Failed to transcribe audio.');
      }
      const data = await response.json();
      let newTranscript = (data.text || '').trim();
      if (!newTranscript && data.error) {
        setError('STT error: ' + data.error);
      }

      if (newTranscript) {
        const userMessage: Message = {
          role: 'user',
          content: newTranscript,
          created_at: new Date().toISOString(),
        };
        setMessages([userMessage]);
        await handleSend(undefined, newTranscript); // Send transcript to AI
        setView('chat'); // Switch to chat view
      } else {
        setError('No speech detected. Please try again.');
        setView('recording'); // Stay on recording view
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Could not process audio.');
      setView('recording');
    } finally {
      setIsLoading(false);
      setIsListening(false);
    }
  };

  // --- CHAT LOGIC (adapted from app/chat/page.tsx) ---
  const handleSend = async (e?: React.FormEvent, messageContent?: string) => {
    if (e) e.preventDefault();
    const contentToSend = messageContent || input;
    if (!contentToSend || isSending) return;

    setIsSending(true);
    setStreamingMsg('');
    setInput('');

    const newUserMessage: Message = {
      role: 'user',
      content: contentToSend,
      created_at: new Date().toISOString(),
    };

    // Add user message only if it's a new input, not the initial transcript
    if (!messageContent) {
      setMessages(prev => [...prev, newUserMessage]);
    }

    const currentMessages = messageContent ? [newUserMessage] : [...messages, newUserMessage];

    try {
      // Concatenate all user messages for prompt
      const prompt = currentMessages.map(m => m.content).join('\n');
      // Streaming agent call just like chat/page.tsx
      const promptToSend = (messageContent ?? (currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].content : '')).trim();
      const requestBody = {
        prompt: promptToSend,
        history: currentMessages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        model: 'moonshotai/kimi-k2-instruct',
        baseURL: 'https://api.groq.com/openai/v1'
      };

      console.log('handleSend debug:', {
        input,
        currentMessages,
        requestBody
      });
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        throw new Error(`API error: ${response.statusText} ${errorText}`);
      }
      if (!response.body) {
        throw new Error('No response body from agent API');
      }
      // Streaming event handling (JSONL)
      const decoder = new TextDecoder();
      let buffer = '';
      let agentReply = '';
      const rawStreamEvents: StreamingEvent[] = [];
      let toolEventsToStore: ToolEvent[] = [];
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: StreamingEvent = JSON.parse(line);
            rawStreamEvents.push(event);
            if (event.type === 'tool_call') {
              // Optionally: handle tool_call UI
            } else if (event.type === 'tool_result') {
              // Optionally: handle tool_result UI
            } else if (event.type === 'final') {
              agentReply += event.content || '';
              setStreamingMsg(agentReply);
            } else if (event.type === 'error') {
              setStreamingMsg(event.error || 'Error');
              setError(event.error || 'Error');
            }
          } catch (err) {
            console.error('Failed to parse stream line:', line, err);
          }
        }
      }
      setStreamingMsg('');
      // After stream, collect toolEvents
      const calls = rawStreamEvents.filter(ev => ev.type === 'tool_call');
      const results = rawStreamEvents.filter(ev => ev.type === 'tool_result');
      for (const call of calls) {
        const result = results.find(r => r.id === call.id);
        if (result) {
          toolEventsToStore.push({
            tool: call.tool || '',
            args: typeof call.args === 'object' && call.args !== null ? JSON.stringify(call.args, null, 2) : call.args,
            id: call.id,
            result: result.result,
          });
        }
      }
      const newAssistantMessage: Message = {
        role: 'assistant',
        content: agentReply || 'No response from agent.',
        created_at: new Date().toISOString(),
        toolEvents: toolEventsToStore.length > 0 ? toolEventsToStore : undefined,
      };
      setMessages(prev => [...prev, newAssistantMessage]);
      // TTS: Block recording and play agent's reply
      setIsSpeaking(true);
      try {
        // Use the LLM endpoint for TTS, prompting it to say exactly the agent's reply
        const ttsPayload = {
          model: 'openai-tts',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `Say exactly: ${agentReply}` }
              ]
            }
          ],
          voice: 'alloy',
          response_format: 'audio' // if supported
        };
        const ttsResponse = await fetch('https://text.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'b7qkSb2f-MUhz2CI',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(ttsPayload)
        });
        if (!ttsResponse.ok) throw new Error('TTS failed');
        const ttsBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(ttsBlob);
        const audio = new Audio(audioUrl);
        await new Promise(resolve => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play();
        });
        URL.revokeObjectURL(audioUrl);
      } catch (ttsErr) {
        console.error('TTS error:', ttsErr);
      } finally {
        setIsSpeaking(false);
        // Only allow listening again after TTS completes
        setIsListening(false);
      }

    } catch (err) {
      console.error('Chat send error:', err);
      setError('Failed to get response from AI.');
    } finally {
      setIsSending(false);
      setStreamingMsg('');
    }
  };

  // --- UI & RENDER ---
  const handleClose = () => {
    if (isListening) stopRecording();
    setView('recording');
    setMessages([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${themeClasses.bg} backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-300`}>
      <div className={`relative w-full h-full ${themeClasses.modalBg} shadow-2xl flex flex-col md:flex-row overflow-hidden`}>
        <button onClick={handleClose} className={`absolute top-8 right-8 ${themeClasses.closeButton} transition-colors z-20`} disabled={isLoading}>
          <X size={24} />
        </button>

        {/* Recording Area (always visible) */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 space-y-12 border-b md:border-b-0 md:border-r border-white/10">
          <div className="relative">
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${isListening ? (isDark ? 'border-red-500' : 'border-red-500') : themeClasses.border}`}>
              {isListening && <div className={`absolute inset-0 rounded-full border-4 ${isDark ? 'border-red-500' : 'border-red-500'} animate-ping`}></div>}
              {isListening ? <Mic size={48} className={`${isDark ? 'text-red-500' : 'text-red-500'} relative z-10`} /> : <MicOff size={48} className={themeClasses.textMuted} />}
            </div>
          </div>
          <div className="text-center">
            {isLoading ? (
              <div className="flex items-center justify-center space-x-3">
                <Loader2 className={`animate-spin ${themeClasses.textSecondary}`} />
                <p className={`${themeClasses.textSecondary} text-lg`}>Processing...</p>
              </div>
            ) : error ? (
              <p className="text-red-500 text-lg">{error}</p>
            ) : isListening ? (
              <p className={`${themeClasses.text} text-xl font-medium`}>Recording...</p>
            ) : isVADActive && !isSpeaking ? (
              <p className={`${themeClasses.text} text-xl font-medium`}>Listening for voice...</p>
            ) : (
              <p className={`${themeClasses.textMuted} text-lg`}>Initializing...</p>
            )}
          </div>
          <button onClick={isListening ? stopRecording : startRecording} disabled={isLoading || isSpeaking} className={`w-full max-w-xs py-4 px-8 rounded-2xl text-lg font-medium transition-all duration-200 ${themeClasses.button} ${(isLoading || isSpeaking) ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
            {isListening ? 'Stop' : isSpeaking ? (
              <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={20} /> Speaking...</span>
            ) : 'Start Recording'}
          </button>
        </div>

        {/* Chat Area (always visible) */}
        <div className="w-full md:w-1/2 flex flex-col transition-none">
          <div className="flex-1 overflow-y-auto p-8 pt-20 pb-32">
            <div className="max-w-3xl mx-auto w-full space-y-8">
              <>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${themeClasses.message.assistant}`}>
                        <Sparkles size={18} />
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl max-w-xl ${msg.role === 'user' ? themeClasses.message.user : themeClasses.message.assistant}`}>
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {/* Tool Calls Dropdown */}
                      {msg.role === 'assistant' && msg.toolEvents && msg.toolEvents.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-semibold">Show Tool Calls</summary>
                          <ul className="mt-2 pl-4 list-disc space-y-2">
                            {msg.toolEvents.map((tool, tIdx) => (
                              <li key={tIdx}>
                                <div><span className="font-bold">Tool:</span> {tool.tool}</div>
                                {tool.args && <div><span className="font-bold">Args:</span> {tool.args}</div>}
                                {tool.result && <div><span className="font-bold">Result:</span> {tool.result}</div>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${themeClasses.message.user}`}>
                        <UserCircle size={20} />
                      </div>
                    )}
                  </div>
                ))}
                {streamingMsg && (
                  <div className="flex gap-4 items-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${themeClasses.message.assistant}`}><Sparkles size={18} /></div>
                    <div className={`p-4 rounded-2xl max-w-xl ${themeClasses.message.assistant}`}>
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>{streamingMsg}</ReactMarkdown>
                      </div>
                      <span className={`inline-block w-2 h-5 ${themeClasses.textSecondary} animate-pulse ml-1`} />
                    </div>
                  </div>
                )}
                {isSending && !streamingMsg && (
                  <div className="flex gap-4 items-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${themeClasses.message.assistant}`}><Sparkles size={18} /></div>
                    <div className="flex items-center gap-2 p-4">
                      <div className="flex gap-1">
                        <div className={`w-2 h-2 ${themeClasses.textSecondary} rounded-full animate-bounce [animation-delay:-.32s]`} />
                        <div className={`w-2 h-2 ${themeClasses.textSecondary} rounded-full animate-bounce [animation-delay:-.16s]`} />
                        <div className={`w-2 h-2 ${themeClasses.textSecondary} rounded-full animate-bounce`} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}