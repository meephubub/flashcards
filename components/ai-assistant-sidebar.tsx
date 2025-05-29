"use client";

import { useState, useRef, useEffect } from "react"; // Removed useMemo as it wasn't used directly here yet
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { processNoteQuestion, generateNoteEdits } from "@/app/actions/ai-notes-assistant";
import { SendIcon, X, PencilLine, HelpCircle, CheckCircle, XCircle, Undo2 } from "lucide-react"; // Added Undo2 icon
import { Note } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIEditOperation } from "@/app/actions/ai-notes-assistant"; // Assuming it can be imported, if not, redefine below

// If AIEditOperation cannot be imported from actions, define it here:
import DiffView from "./diff-view"; // Import the new DiffView component

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
  const [lastAppliedEdit, setLastAppliedEdit] = useState<{
    originalContent: string;
    appliedContent: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Focus input after animation completes
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300); // Match the animation duration
      return () => clearTimeout(timer);
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
    setLastAppliedEdit(null); // Reset revert state when note changes
  }, [currentNote?.id]);

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
        const newContentPreview = applyAiOperations(currentNote.content, operations);
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { 
                  ...msg, 
                  role: "assistant" as const,
                  content: `I've prepared some edits. Review them below:`, 
                  type: "edit",
                  suggestedOperations: operations,
                  isEditing: true,
                  editContent: newContentPreview,
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
              ? { ...msg, content: questionResponse } 
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
            ? { ...msg, content: `Error: ${errorMessage}` } 
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

  const handleApplyEdit = (editContentToApply: string) => {
    if (currentNote) {
      setLastAppliedEdit({
        originalContent: currentNote.content, 
        appliedContent: editContentToApply,
      });
      onApplyEdit(editContentToApply); 
      setMessages(prev =>
        prev.map(msg =>
          msg.editContent === editContentToApply && msg.isEditing
            ? { ...msg, isEditing: false, content: "Edits applied. You can revert this change below." } 
            : msg
        )
      );
    }
  };

  const handleRevertLastEdit = () => {
    if (lastAppliedEdit) {
      onApplyEdit(lastAppliedEdit.originalContent);
      const revertedFrom = lastAppliedEdit.appliedContent;
      setLastAppliedEdit(null); 
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + "-revert",
          role: "assistant" as const,
          content: "The last applied edit has been reverted.",
          type: "edit", 
        },
      ]);
    }
  };

  const toggleMode = () => {
    setIsEditMode(!isEditMode);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div 
      className={`fixed top-0 right-0 h-full bg-neutral-900 border-l border-neutral-800 shadow-xl z-40 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      style={{
        width: isOpen ? 'min(350px, 85vw)' : '0',
        maxWidth: '100vw'
      }}
    >
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center space-x-2">
          {isEditMode ? (
            <PencilLine size={18} className="text-blue-400" />
          ) : (
            <HelpCircle size={18} className="text-blue-400" />
          )}
          <h2 className="text-lg font-semibold text-neutral-100">
            {isEditMode ? "AI Note Editor" : "AI Assistant"}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMode}
            className={`text-xs p-1.5 rounded-md ${isEditMode ? 'bg-blue-900/30 text-blue-400' : 'text-neutral-400 hover:text-neutral-100'}`}
          >
            {isEditMode ? 'Switch to Q&A' : 'Switch to Edit'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
          >
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
                        ? 'bg-neutral-800 text-neutral-100'
                        : (message.isEditing ? "bg-neutral-800" : "bg-neutral-700 text-neutral-100")
                    }`}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-pulse">Thinking...</div>
                      </div>
                    ) : message.role === 'assistant' && message.isEditing ? (
                      <div className="space-y-3">
                        <div className="text-sm opacity-80">Suggested Edit Preview:</div>
                        <div className="bg-neutral-800 p-3 rounded-md text-neutral-200"> {/* Themed from bg-neutral-850 */}
                          <p className="text-sm font-medium mb-2 text-neutral-300">{message.content}</p>
                          <div className="text-xs max-h-60 overflow-y-auto border border-neutral-700 p-2 rounded bg-neutral-900">
                            <DiffView
                              oldValue={currentNote?.content || ""}
                              newValue={message.editContent || ""}
                            />
                          </div>
                          <div className="flex justify-end space-x-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-xs px-2 py-1 h-auto"
                              onClick={() => navigator.clipboard.writeText(message.editContent || "")}
                            >
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-neutral-800 text-red-400 border-neutral-700 hover:bg-neutral-700 text-xs px-2 py-1 h-auto"
                              onClick={() => {
                                setMessages(prev =>
                                  prev.map(msg =>
                                    msg.id === message.id ? { ...msg, isEditing: false } : msg
                                  )
                                );
                              }}
                            >
                              <XCircle size={14} className="mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-neutral-800 text-green-400 border-neutral-700 hover:bg-neutral-700 text-xs px-2 py-1 h-auto"
                              onClick={() => handleApplyEdit(message.editContent || "")}
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Apply
                            </Button>
                          </div>
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
            placeholder={isEditMode ? "Describe changes (e.g., 'fix typos', 'summarize')" : "Ask a question about your notes..."}
            className="flex-1 bg-neutral-800 border-neutral-700 focus:border-neutral-500 text-neutral-100"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className={`bg-neutral-700 hover:bg-neutral-600 text-neutral-100 ${!input.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <SendIcon size={16} />
          </Button>
        </form>
        <div className="mt-2 text-center">
          <div className="flex flex-col items-center space-y-2">
            {lastAppliedEdit && (
              <Button
                variant="outline"
                size="sm" // Standardized size, adjust if 'xs' was intended and defined
                onClick={handleRevertLastEdit}
                className="text-xs text-neutral-400 hover:text-neutral-100 border-neutral-700 hover:bg-neutral-700 px-2 py-1 h-auto w-full max-w-xs"
              >
                <Undo2 size={14} className="mr-1" /> Revert Last Applied Edit
              </Button>
            )}
            <p className="text-neutral-500 text-xs">
              Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-400">Ctrl+E</kbd> to toggle mode
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
