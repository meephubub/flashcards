"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { processNoteQuestion, generateNoteEdits } from "@/app/actions/ai-notes-assistant";
import { SendIcon, X, PencilLine, HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { Note } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIEditOperation } from "@/app/actions/ai-notes-assistant"; // Assuming it can be imported, if not, redefine below

// If AIEditOperation cannot be imported from actions, define it here:
// export interface AIEditOperation {
//   operation: "replace" | "insert" | "delete";
//   startIndex: number;
//   endIndex?: number;
//   text?: string;
// }

interface AIAssistantSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentNote: Note | null;
  onApplyEdit: (newContent: string) => void;
}

type Message = {
  suggestedOperations?: AIEditOperation[];
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "question" | "edit";
  isLoading?: boolean;
  isEditing?: boolean;
  editContent?: string;
};

export function AIAssistantSidebar({ 
  isOpen, 
  onClose, 
  currentNote,
  onApplyEdit
}: AIAssistantSidebarProps) {
  const [input, setInput] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset messages when note changes
  useEffect(() => {
    setMessages([]);
    setInput("");
    setIsEditMode(false);
  }, [currentNote?.id]);

  if (!isOpen) return null;

  // Helper function to apply AI operations to note content
  function applyAiOperations(originalContent: string, operations: AIEditOperation[]): string {
    if (!operations || operations.length === 0) return originalContent;

    let newContent = originalContent;
    // Create a mutable copy of operations to sort them by startIndex in descending order.
    // This is crucial for applying changes correctly without subsequent operations being affected by index shifts.
    const sortedOperations = [...operations].sort((a, b) => (b.startIndex ?? 0) - (a.startIndex ?? 0));

    for (const op of sortedOperations) {
      try {
        switch (op.operation) {
          case "replace":
            if (typeof op.startIndex === 'number' && typeof op.endIndex === 'number' && typeof op.text === 'string') {
              newContent = newContent.substring(0, op.startIndex) + op.text + newContent.substring(op.endIndex);
            }
            break;
          case "insert":
            if (typeof op.startIndex === 'number' && typeof op.text === 'string') {
              newContent = newContent.substring(0, op.startIndex) + op.text + newContent.substring(op.startIndex);
            }
            break;
          case "delete":
            if (typeof op.startIndex === 'number' && typeof op.endIndex === 'number') {
              newContent = newContent.substring(0, op.startIndex) + newContent.substring(op.endIndex);
            }
            break;
          default:
            console.warn(`Unknown operation type: ${(op as any).operation}`);
        }
      } catch (e) {
        console.error("Error applying operation:", op, e);
        // Potentially skip this operation or handle error more gracefully
      }
    }
    return newContent;
  }


  async function handleSendMessage() {
    console.log('[AIAssistantSidebar] handleSendMessage called');
    console.log('[AIAssistantSidebar] Input:', input);
    console.log('[AIAssistantSidebar] Current Note:', currentNote);
    if (!input.trim() || !currentNote) {
      console.warn('[AIAssistantSidebar] Aborting send: Input empty or no current note.');
      return;
    }
    
    const messageId = Date.now().toString();
    const userMessage: Message = {
      id: messageId,
      role: "user",
      content: input,
      type: isEditMode ? "edit" : "question",
    };
    
    const assistantMessage: Message = {
      id: `${messageId}-response`,
      role: "assistant",
      content: "",
      type: isEditMode ? "edit" : "question",
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response: AIEditOperation[] | string | undefined;
      if (isEditMode) {
        const operations = await generateNoteEdits(
          currentNote.content, 
          currentNote.title, 
          input
        );
        // response = operations; // Keep for type consistency if needed elsewhere, or remove if only operations is used.

        if (!currentNote) { // Should be caught earlier, but as a safeguard
            throw new Error("Current note became null during edit generation.");
        }

        const newContentPreview = applyAiOperations(currentNote.content, operations);
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { 
                  ...msg, 
                  // content: "Here are the suggested edits:", // Or a summary of operations
                  content: `Suggested ${operations.length} change(s). Preview below.`, // Simple content
                  suggestedOperations: operations,
                  editContent: newContentPreview,
                  isLoading: false,
                  isEditing: true
                } 
              : msg
          )
        );
      } else {
        const questionResponse = await processNoteQuestion(
          currentNote.content, 
          currentNote.title, 
          input
        );
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: questionResponse, isLoading: false } 
              : msg
          )
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An error occurred while processing your request";
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: `Error: ${errorMessage}`, isLoading: false } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleApplyEdit(editContent: string) {
    if (editContent && currentNote) {
      onApplyEdit(editContent);
      
      // Add a system message confirming the edit was applied
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "✅ Note updated successfully!",
          type: "question"
        }
      ]);
    }
  }

  const toggleMode = () => {
    setIsEditMode(!isEditMode);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="fixed right-0 top-0 z-50 h-screen w-[400px] bg-neutral-900 border-l border-neutral-800 shadow-xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <h3 className="font-semibold text-neutral-100">AI Assistant</h3>
        <div className="flex gap-2">
          <Button
            onClick={toggleMode}
            variant="ghost"
            size="sm"
            className={`text-xs p-2 ${isEditMode ? 'bg-blue-900/30 text-blue-400' : ''}`}
          >
            {isEditMode ? <PencilLine size={18} /> : <HelpCircle size={18} />}
            <span className="ml-1">{isEditMode ? 'Edit Mode' : 'Question Mode'}</span>
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm" className="text-neutral-400 hover:text-neutral-100">
            <X size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <ScrollArea className="h-full w-full pr-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-500">
              <div className="mb-2">
                {isEditMode ? <PencilLine size={32} /> : <HelpCircle size={32} />}
              </div>
              <p className="mb-2 font-medium text-lg">
                {isEditMode 
                  ? "I'll help you edit your notes" 
                  : "Ask me questions about your notes"}
              </p>
              <p className="text-sm">
                {isEditMode 
                  ? "Tell me what changes you'd like to make to your note." 
                  : "I can help you understand concepts in your notes or provide additional information."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[300px] p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-800 text-neutral-100'
                    }`}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-pulse">Thinking...</div>
                      </div>
                    ) : message.role === 'assistant' && message.isEditing ? (
                      <div className="space-y-3">
                        <div className="text-sm opacity-80">Suggested Edit Preview:</div>
                        {message.content && !message.isEditing && <div className="text-xs italic opacity-70 pb-1">{message.content}</div>} {/* Shows 'Suggested N changes' etc. */}
                        <div className="max-h-[200px] overflow-y-auto text-sm border border-neutral-600 rounded-md p-3 bg-neutral-800 shadow-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.editContent || "No preview available."}</ReactMarkdown>
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-xs px-2 py-1 h-auto"
                            onClick={() => {
                              // Copy to clipboard
                              navigator.clipboard.writeText(message.editContent || "");
                            }}
                          >
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-900/30 text-red-400 border-red-900/50 hover:bg-red-900/50 text-xs px-2 py-1 h-auto"
                            onClick={() => {
                              // Reject edit
                              setMessages(prev =>
                                prev.map(msg =>
                                  msg.id === message.id
                                    ? { ...msg, isEditing: false }
                                    : msg
                                )
                              );
                            }}
                          >
                            <XCircle size={14} className="mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-900/30 text-green-400 border-green-900/50 hover:bg-green-900/50 text-xs px-2 py-1 h-auto"
                            onClick={() => handleApplyEdit(message.editContent || "")}
                          >
                            <CheckCircle size={14} className="mr-1" />
                            Apply
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-neutral-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEditMode ? "What edits would you like to make?" : "Ask a question about your notes..."}
            className="flex-1 bg-neutral-800 border-neutral-700 focus:border-blue-600 text-neutral-100"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className={`bg-blue-600 hover:bg-blue-700 text-white ${!input.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <SendIcon size={16} />
          </Button>
        </form>
        <div className="mt-2 text-center">
          <p className="text-neutral-500 text-xs">
            Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-400">Ctrl+E</kbd> to toggle the assistant
          </p>
        </div>
      </div>
    </div>
  );
}
