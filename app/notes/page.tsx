"use client"

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import type { Note } from "@/lib/supabase";
import type { MultipleChoiceQuestion, MCQGenerationResult } from "@/lib/groq";
import { NotesSidebar } from "@/components/NotesSidebar";
import { CategoryCombobox } from "@/components/ui/CategoryCombobox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { XIcon, ListIcon, SparklesIcon, PlusCircleIcon, SendIcon, HelpCircleIcon, CheckCircle2, XCircle, InfoIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as ShadDialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

// Helper to generate slugs for IDs
const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/[^\w-]+/g, ''); // Remove all non-word chars
};

// Enhanced renderNoteContent function
const renderNoteContent = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  const processList = () => {
    if (inList && listItems.length > 0) {
      if (listType === 'ul') {
        elements.push(<ul key={`list-${elements.length}`} className="list-disc list-outside pl-6 my-3 space-y-1.5 text-neutral-300">{listItems}</ul>);
      } else if (listType === 'ol') {
        elements.push(<ol key={`list-${elements.length}`} className="list-decimal list-outside pl-6 my-3 space-y-1.5 text-neutral-300">{listItems}</ol>);
      }
    }
    inList = false;
    listItems = [];
    listType = null;
  };

  const processTable = () => {
    if (tableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-neutral-700">
            <thead>
              <tr>
                {tableHeaders.map((header, index) => (
                  <th key={index} className="border border-neutral-700 bg-neutral-800 px-4 py-2 text-left text-neutral-200 font-semibold">
                    {parseInlineMarkdown(header.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-800/50'}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-neutral-700 px-4 py-2 text-neutral-300">
                      {parseInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableRows = [];
    tableHeaders = [];
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check for table
    if (line.includes('|')) {
      const cells = line.split('|').filter(cell => cell.trim() !== '');
      
      // Check if this is a separator line (contains only dashes and |)
      if (line.replace(/[\s|]/g, '').replace(/-/g, '') === '') {
        continue; // Skip separator line
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      processTable();
    }

    // Check for line break (---)
    if (line.trim() === '---') {
      elements.push(<hr key={i} className="my-8 border-neutral-700/50" />);
      continue;
    }

    // Check for list items first to handle them before paragraphing
    const ulMatch = line.match(/^\s*[-*]\s+(.*)/);
    const olMatch = line.match(/^\s*\d+\.\s+(.*)/);

    if (ulMatch) {
      if (listType !== 'ul') {
        processList(); // Process any existing list
        inList = true;
        listType = 'ul';
      }
      listItems.push(<li key={`item-${i}`}>{parseInlineMarkdown(ulMatch[1])}</li>);
      continue;
    } else if (olMatch) {
      if (listType !== 'ol') {
        processList(); // Process any existing list
        inList = true;
        listType = 'ol';
      }
      listItems.push(<li key={`item-${i}`}>{parseInlineMarkdown(olMatch[1])}</li>);
      continue;
    } else {
      processList(); // If line is not a list item, process any existing list
    }

    // Headings (H1-H6)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = parseInlineMarkdown(headingMatch[2]);
      const headingId = `heading-${generateSlug(headingMatch[2].trim())}`;
      
      switch (level) {
        case 1: elements.push(<h1 id={headingId} key={i} className="text-4xl font-bold mt-10 mb-5 text-neutral-100 tracking-tight">{text}</h1>); break;
        case 2: elements.push(<h2 id={headingId} key={i} className="text-3xl font-semibold mt-8 mb-4 text-neutral-100 tracking-tight">{text}</h2>); break;
        case 3: elements.push(<h3 id={headingId} key={i} className="text-2xl font-semibold mt-7 mb-3 text-neutral-200">{text}</h3>); break;
        case 4: elements.push(<h4 id={headingId} key={i} className="text-xl font-semibold mt-6 mb-2 text-neutral-200">{text}</h4>); break;
        case 5: elements.push(<h5 id={headingId} key={i} className="text-lg font-semibold mt-5 mb-2 text-neutral-300">{text}</h5>); break;
        case 6: elements.push(<h6 id={headingId} key={i} className="text-base font-semibold mt-4 mb-2 text-neutral-300">{text}</h6>); break;
      }
      continue;
    }

    // Horizontal Rule
    if (line.match(/^(\s*([-*_]){3,}\s*)$/)) {
      elements.push(<hr key={i} className="my-8 border-neutral-700/50" />);
      continue;
    }
    
    // Blockquotes
    const blockquoteMatch = line.match(/^>\s*(.*)/);
    if (blockquoteMatch) {
        elements.push(
            <blockquote key={i} className="pl-4 italic border-l-2 border-neutral-600/70 text-neutral-400 my-4 py-0.5">
                {parseInlineMarkdown(blockquoteMatch[1])}
            </blockquote>
        );
        continue;
    }

    // Code blocks (triple backticks)
    if (line.startsWith("```")) {
      const codeLines = [];
      const lang = line.slice(3).trim();
      i++;
      
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      
      if (i < lines.length) { // Found closing ```
        elements.push(
          <pre key={`code-${i}`} className="bg-neutral-800 p-4 rounded-md my-4 overflow-x-auto">
            <code className="text-sm font-mono text-neutral-200">
              {codeLines.join('\n')}
            </code>
          </pre>
        );
      }
      continue;
    }

    // Align center with ::
    if (line.startsWith("::") && line.endsWith("::")) {
      const centerText = line.slice(2, -2).trim();
      if (centerText) {
        elements.push(
          <p key={i} className="text-center text-neutral-300 my-3">
            {parseInlineMarkdown(centerText)}
          </p>
        );
        continue;
      }
    }

    // Default: Paragraph (or empty line for spacing)
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-4"></div>); // Create some space for empty lines
    } else {
      elements.push(<p key={i} className="text-neutral-300 leading-relaxed my-3">{parseInlineMarkdown(line)}</p>);
    }
  }
  processList(); // Process any remaining list items after the loop
  processTable(); // Process any remaining table after the loop

  return <>{elements}</>; // Return a fragment
};

// Helper function for inline Markdown parsing
const parseInlineMarkdown = (text: string): React.ReactNode => {
  // Links: [text](url) - Basic styling, not a real link for simplicity in this regex approach
  let processedText = text.replace(/!?\[(.*?)\]\((.*?)\)/g, (match, p1, p2) => {
    return `<a class="text-neutral-400 underline hover:text-neutral-300 cursor-pointer transition-colors" href="${p2}" target="_blank" rel="noopener noreferrer">${p1}</a>`;
  });

  // Order matters: Process **bold** and *italic* after links and code to avoid conflicts
  // Strikethrough: ~~text~~
  processedText = processedText.replace(/~~(.*?)~~/g, '<del class="text-neutral-500">$1</del>');

  // Bold: **text** or __text__ (ensure __ is not part of a word_internal_thing)
  processedText = processedText.replace(/(?<!\w)\*\*(?!\s)(.*?)(?<!\s)\*\*(?!\w)/g, '<strong class="font-bold text-neutral-200">$1</strong>');
  processedText = processedText.replace(/(?<!\w)__(?!\s)(.*?)(?<!\s)__(?!\w)/g, '<strong class="font-bold text-neutral-200">$1</strong>');

  // Italic: *text* or _text_ (ensure _ is not part of a word_internal_thing)
  processedText = processedText.replace(/(?<!\w)\*(?!\s)(.*?)(?<!\s)\*(?!\w)/g, '<em class="italic text-neutral-300">$1</em>');
  processedText = processedText.replace(/(?<![a-zA-Z0-9])_(?!\s)(.*?)(?<!\s)_(?![a-zA-Z0-9])/g, '<em class="italic text-neutral-300">$1</em>');
  
  // Highlight: ==text==
  processedText = processedText.replace(/==(.*?)==/g, '<span class="bg-[rgba(140,140,140,0.4)] text-neutral-200 px-1 rounded">$1</span>');
  
  // Inline Code: `code`
  processedText = processedText.replace(/`(.*?)`/g, '<code class="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded-md text-sm font-mono">$1</code>');
  
  return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
};

export default function NotesPage() {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [displayedNotes, setDisplayedNotes] = useState<Note[]>([]);
  const [subheadings, setSubheadings] = useState<string[]>([]);
  const [currentNoteHeadings, setCurrentNoteHeadings] = useState<{text: string, level: number}[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [highlightedText, setHighlightedText] = useState<string>("");
  
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    category: "" // Default category to empty, user must select or create
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [selectedSidebarCategory, setSelectedSidebarCategory] = useState("all");
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [generationTopic, setGenerationTopic] = useState<string>("");
  const [isGeneratingNote, setIsGeneratingNote] = useState<boolean>(false);
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState<boolean>(false);
  const [isAiChatDialogOpen, setIsAiChatDialogOpen] = useState<boolean>(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isProcessingAiRequest, setIsProcessingAiRequest] = useState<boolean>(false);
  const [isMcqDialogOpen, setIsMcqDialogOpen] = useState<boolean>(false);
  const [generatedMcqs, setGeneratedMcqs] = useState<MultipleChoiceQuestion[]>([]);
  const [isGeneratingMcqs, setIsGeneratingMcqs] = useState<boolean>(false);
  const [mcqError, setMcqError] = useState<string | null>(null);
  const [currentMcqNoteTitle, setCurrentMcqNoteTitle] = useState<string | undefined>(undefined);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showMcqResults, setShowMcqResults] = useState<boolean>(false);

  const notesContainerRef = useRef<HTMLDivElement>(null);
  const activeNoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  // Derive available categories from all notes
  useEffect(() => {
    const categoriesFromNotes = Array.from(new Set(allNotes.map(note => note.category.trim().toLowerCase()).filter(cat => cat)));
    categoriesFromNotes.sort((a, b) => a.localeCompare(b));
    setAvailableCategories(categoriesFromNotes);
    // If current newNote.category is not in the fetched notes and not empty, add it to available for consistency
    // Or, more simply, let the Combobox handle new typed values directly.
  }, [allNotes]);

  useEffect(() => {
    let notesToDisplay = allNotes;
    if (selectedSidebarCategory !== "all") {
      notesToDisplay = allNotes.filter(note => note.category === selectedSidebarCategory);
    }
    if (focusedNoteId) {
      const focused = notesToDisplay.find(note => note.id === focusedNoteId);
      setDisplayedNotes(focused ? [focused] : []);
      
      // Extract headings from the focused note
      if (focused) {
        extractHeadingsFromNote(focused);
      } else {
        setCurrentNoteHeadings([]);
      }
    } else {
      setDisplayedNotes(notesToDisplay);
      setCurrentNoteHeadings([]);
    }
  }, [allNotes, selectedSidebarCategory, focusedNoteId]);

  useEffect(() => {
    const extracted: string[] = [];
    allNotes.forEach(note => {
      const lines = note.content.split('\n');
      lines.forEach(line => {
        // Updated to use H2 from the new renderNoteContent logic for consistency
        if (line.match(/^##\s+(.*)/)) { 
          const heading = line.match(/^##\s+(.*)/)![1].trim();
          if (heading && !extracted.includes(heading)) {
            extracted.push(heading);
          }
        }
      });
    });
    extracted.sort((a, b) => a.localeCompare(b));
    setSubheadings(extracted);
  }, [allNotes]);

  useEffect(() => {
    if (focusedNoteId && activeNoteRef.current) {
      activeNoteRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusedNoteId, displayedNotes]);

  // Handle text selection and Ctrl+K and Ctrl+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === 'k') {
          e.preventDefault();
          const selection = window.getSelection();
          if (selection && selection.toString().trim()) {
            setSelectedText(selection.toString().trim());
            setAiPrompt("");
            setAiResponse("");
            setIsAiChatDialogOpen(true);
          }
        } else if (e.key === 'b') {
          e.preventDefault();
          const selection = window.getSelection();
          if (selection && selection.toString().trim()) {
            setHighlightedText(selection.toString().trim());
            // Find the note containing the selection
            const range = selection.getRangeAt(0);
            const noteElement = (range.commonAncestorContainer as Element).closest('[id^="note-"]');
            if (noteElement) {
              const noteId = noteElement.id.replace('note-', '');
              const note = allNotes.find(n => n.id === noteId);
              if (note) {
                // Update the note content with highlighted text
                const updatedContent = note.content.replace(
                  selection.toString().trim(),
                  `==${selection.toString().trim()}==`
                );
                // Update the note in Supabase
                supabase
                  .from("notes")
                  .update({ content: updatedContent })
                  .eq("id", noteId)
                  .then(() => {
                    // Refresh notes after update
                    fetchNotes();
                  });
              }
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [allNotes]);

  // Apply text selection styles
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      ::-moz-selection {
        background: rgba(140, 140, 140, 0.4) !important;
        color: inherit !important;
      }
      ::selection {
        background: rgba(140, 140, 140, 0.4) !important;
        color: inherit !important;
      }
    `;
    // Append to head
    document.head.appendChild(styleElement);
    
    // Cleanup function
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching notes:", error);
        setErrorMessage(`Error fetching notes: ${error.message}`);
        throw error;
      }
      if (data) {
        setAllNotes(data as Note[]);
        setErrorMessage(null);
      }
    } catch (error) {
      // Error message already set or logged
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (!newNote.title || !newNote.content) {
      setErrorMessage("Title and content are required.");
      return;
    }
    if (!newNote.category.trim()) {
      setErrorMessage("Category is required. Please select or create one.");
      return;
    }

    setIsLoading(true);
    try {
      const noteToInsert = {
        title: newNote.title,
        content: newNote.content,
        category: newNote.category.trim().toLowerCase()
      };
      
      const { data, error } = await supabase.from("notes").insert(noteToInsert).select().single();

      if (error) {
        console.error("Supabase error adding note:", error);
        setErrorMessage(`Error adding note: ${error.message}`);
        throw error;
      }
      
      setNewNote({ title: "", content: "", category: "" });
      await fetchNotes(); // Refresh all notes
      if (data) {
        if(selectedSidebarCategory === 'all' || data.category === selectedSidebarCategory) {
          setFocusedNoteId(data.id);
        }
      }
    } catch (error: any) {
      // Error message already set
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteSelectInSidebar = (noteId: string) => {
    setFocusedNoteId(noteId);
  };

  const handleCategorySelectFromSidebar = (category: string) => {
    setSelectedSidebarCategory(category);
    setFocusedNoteId(null);
  };

  const handleSubheadingClick = (subheading: string) => {
    const targetNote = allNotes.find(note => {
      const lines = note.content.split('\n');
      // Updated to use H2 from the new renderNoteContent logic for consistency
      return lines.some(line => line.match(/^##\s+(.*)/) && line.match(/^##\s+(.*)/)![1].trim() === subheading);
    });
    if (targetNote) {
      if (selectedSidebarCategory !== 'all' && targetNote.category !== selectedSidebarCategory) {
        setSelectedSidebarCategory('all');
      }
      setFocusedNoteId(targetNote.id);
    }
  };

  const clearFocus = () => {
    setFocusedNoteId(null);
  };

  const handleGenerateNote = async () => {
    if (!generationTopic.trim()) {
      setErrorMessage("Please enter a topic to generate the note.");
      return;
    }
    setIsGeneratingNote(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: generationTopic }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to generate note from API.");
      }

      const data = await response.json();
      setNewNote({ title: data.title, content: data.content, category: newNote.category || "" });
      setGenerationTopic(""); // Clear topic input after generation
      setErrorMessage(null);
    } catch (error: any) {
      console.error("Error generating note via API:", error);
      setErrorMessage(error.message || "An unexpected error occurred while generating the note.");
      // Optionally, clear title/content if generation fails badly
      // setNewNote({ title: "", content: "", category: newNote.category || "" }); 
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const handleSuccessfulNoteAdd = () => {
    setIsAddNoteDialogOpen(false);
  };

  // Extract headings from a note
  const extractHeadingsFromNote = (note: Note) => {
    const headings: {text: string, level: number}[] = [];
    const lines = note.content.split('\n');
    
    lines.forEach(line => {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        headings.push({ text, level });
      }
    });
    
    setCurrentNoteHeadings(headings);
  };

  // Handle AI chat request
  const handleAiChatRequest = async () => {
    if (!aiPrompt.trim() && !selectedText.trim()) return;
    
    setIsProcessingAiRequest(true);
    try {
      const prompt = aiPrompt.trim() 
        ? `Selected text: "${selectedText}"\n\nUser query: ${aiPrompt}`
        : `Analyze or explain this text: "${selectedText}"`;
        
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setAiResponse(data.response || "I couldn't generate a response. Please try again.");
    } catch (error) {
      console.error("Error in AI chat request:", error);
      setAiResponse("Sorry, there was an error processing your request. Please try again later.");
    } finally {
      setIsProcessingAiRequest(false);
    }
  };

  const handleGenerateMcqs = async () => {
    if (!focusedNoteId) {
      setMcqError("Please select a note to generate MCQs from.");
      return;
    }
    const noteToGenerateFrom = allNotes.find(note => note.id === focusedNoteId);
    if (!noteToGenerateFrom) {
      setMcqError("Focused note not found.");
      return;
    }

    setIsGeneratingMcqs(true);
    setMcqError(null);
    setGeneratedMcqs([]);
    setUserAnswers({});
    setShowMcqResults(false);
    setCurrentMcqNoteTitle(noteToGenerateFrom.title);

    try {
      const response = await fetch("/api/generate-mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteContent: noteToGenerateFrom.content,
          noteTitle: noteToGenerateFrom.title,
          numberOfQuestions: 5 // Or make this configurable
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate MCQs from API.");
      }

      const data: MCQGenerationResult = await response.json();
      if (data.mcqs && data.mcqs.length > 0) {
        setGeneratedMcqs(data.mcqs);
        setIsMcqDialogOpen(true);
      } else {
        setMcqError("No MCQs were generated for this note. The content might be too short or not suitable.");
      }
    } catch (error: any) {
      console.error("Error generating MCQs:", error);
      setMcqError(error.message || "An unexpected error occurred while generating MCQs.");
    } finally {
      setIsGeneratingMcqs(false);
    }
  };

  const handleMcqOptionSelect = (questionIndex: number, option: string) => {
    setUserAnswers(prev => ({ ...prev, [questionIndex]: option }));
  };

  const handleSubmitMcqs = () => {
    setShowMcqResults(true);
  };
  
  const calculateMcqScore = () => {
    let correctCount = 0;
    generatedMcqs.forEach((mcq, index) => {
      if (userAnswers[index] === mcq.correctAnswer) {
        correctCount++;
      }
    });
    return {
      correct: correctCount,
      total: generatedMcqs.length,
      percentage: generatedMcqs.length > 0 ? (correctCount / generatedMcqs.length) * 100 : 0
    };
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <NotesSidebar
        notes={allNotes} 
        categories={availableCategories}
        selectedCategory={selectedSidebarCategory}
        onSelectCategory={handleCategorySelectFromSidebar}
        onSelectNote={handleNoteSelectInSidebar}
        className="w-64 md:w-72 lg:w-80 border-r border-neutral-800 flex-shrink-0"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={notesContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 scroll-smooth">
          <div className="mt-6 space-y-8 max-w-4xl mx-auto">
            {isLoading && displayedNotes.length === 0 && <p className="text-center text-neutral-500 py-10">Loading notes...</p>}
            {!isLoading && displayedNotes.length === 0 && selectedSidebarCategory === 'all' && !focusedNoteId && (
              <div className="text-center text-neutral-400 py-10 text-lg">
                <p>No notes yet. Create your first note!</p>
                <Button onClick={() => setIsAddNoteDialogOpen(true)} className="mt-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700">
                  <PlusCircleIcon className="mr-2 h-5 w-5" /> Add Your First Note
                </Button>
              </div>
            )}
            {!isLoading && displayedNotes.length === 0 && selectedSidebarCategory !== 'all' && !focusedNoteId && <p className="text-center text-neutral-400 py-10 text-lg">No notes in "{selectedSidebarCategory.charAt(0).toUpperCase() + selectedSidebarCategory.slice(1)}".</p>}
            {!isLoading && displayedNotes.length === 0 && focusedNoteId && <p className="text-center text-neutral-400 py-10 text-lg">Note not found or does not match category.</p>} 
            
            {displayedNotes.map((note) => (
              <Card 
                key={note.id} 
                id={`note-${note.id}`}
                ref={focusedNoteId === note.id ? activeNoteRef : null}
                className="bg-neutral-900 border-neutral-800 border-[0.5px] rounded-xl shadow-xl p-6 md:p-8 transition-all duration-300 ease-in-out hover:shadow-2xl data-[focused='true']:ring-1 data-[focused='true']:ring-neutral-500 data-[focused='true']:scale-[1.01]"
                data-focused={focusedNoteId === note.id}
              >
                <h3 className="text-4xl font-bold mb-6 pb-4 border-b border-neutral-700/50 text-neutral-50">{note.title}</h3>
                <div className="prose-custom max-w-none">
                  {renderNoteContent(note.content)}
                </div>
                <div className="text-xs text-neutral-500 mt-8 pt-4 border-t border-neutral-700/50">
                  Category: <span className="font-medium text-neutral-400">{note.category.charAt(0).toUpperCase() + note.category.slice(1)}</span> | Created: {new Date(note.created_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Floating Bottom Nav Bar */}
        <div className="w-full p-4 border-t border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.4)] sticky bottom-0 z-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost"
              size="icon" 
              onClick={() => setIsAddNoteDialogOpen(true)} 
              className="text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-lg backdrop-blur-sm border border-white/10 transition-all duration-200"
              aria-label="Add new note"
            >
              <PlusCircleIcon className="h-5 w-5" />
            </Button>
            
            <span className="hidden md:inline-flex items-center text-xs text-neutral-400 border border-white/10 rounded-lg px-2.5 py-1.5 bg-neutral-800/30 backdrop-blur-sm">
              <SparklesIcon className="h-3 w-3 mr-1.5" /> <kbd className="font-mono text-[10px]">Ctrl+K</kbd>
            </span>
            
            <span className="hidden md:inline-flex items-center text-xs text-neutral-400 border border-white/10 rounded-lg px-2.5 py-1.5 bg-neutral-800/30 backdrop-blur-sm">
              <span className="h-3 w-3 mr-1.5 flex items-center justify-center font-bold">H</span> <kbd className="font-mono text-[10px]">Ctrl+B</kbd>
            </span>
          </div>

          <ScrollArea className="whitespace-nowrap flex-grow mx-4">
            <div className="flex space-x-2 items-center h-10">
              {focusedNoteId && currentNoteHeadings.length > 0 ? (
                currentNoteHeadings.map((heading, index) => (
                  <Button
                    key={`heading-${index}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const headingEl = document.getElementById(`heading-${generateSlug(heading.text)}`);
                      if (headingEl) headingEl.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`text-neutral-300 hover:text-white hover:bg-white/5 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all rounded-lg px-3 py-2 text-sm ${
                      heading.level === 1 ? 'font-semibold' : 
                      heading.level === 2 ? 'pl-3' : 
                      heading.level === 3 ? 'pl-4 text-sm' : 
                      'pl-5 text-xs'
                    }`}
                  >
                    {heading.level > 1 && <span className="opacity-60 mr-1">{'•'.repeat(heading.level - 1)}</span>}
                    {heading.text}
                  </Button>
                ))
              ) : focusedNoteId ? (
                <p className="text-sm text-neutral-500 px-3">No headings in this note. Add with # or ##.</p>
              ) : subheadings.length > 0 ? (
                subheadings.map(sh => (
                  <Button
                    key={generateSlug(sh)}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSubheadingClick(sh)}
                    className="text-neutral-300 hover:text-white hover:bg-white/5 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all rounded-lg px-3 py-2 text-sm"
                  >
                    {sh}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-neutral-500 px-3">No H2 subheadings (##). Add notes with `## Your Subheading`.</p>
              )}
            </div>
            <ScrollBar orientation="horizontal" className="[&>div]:bg-neutral-700/50 hover:[&>div]:bg-neutral-600/60" />
          </ScrollArea>
          {focusedNoteId && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={handleGenerateMcqs} 
              disabled={isGeneratingMcqs}
              className="flex-shrink-0 text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2 transition-all duration-200"
            >
              {isGeneratingMcqs ? (
                <SparklesIcon className="h-4 w-4 mr-2 animate-spin" /> 
              ) : (
                <><HelpCircleIcon className="h-4 w-4 mr-2" /> Quiz Me</>
              )}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <ShadDialogTitle className="text-2xl font-bold text-neutral-100">Add New Note</ShadDialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mb-6 p-4 border border-neutral-700 rounded-lg bg-neutral-800/50">
              <p className="text-sm text-neutral-300 font-medium">Generate with AI ✨</p>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter a topic for AI note generation..."
                  value={generationTopic}
                  onChange={(e) => setGenerationTopic(e.target.value)}
                  className="bg-neutral-700 border-neutral-600 text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-neutral-500 flex-grow"
                  disabled={isGeneratingNote}
                />
                <Button 
                  onClick={handleGenerateNote} 
                  disabled={isGeneratingNote || !generationTopic.trim()}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold transition-all duration-150 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 whitespace-nowrap border border-neutral-700"
                >
                  {isGeneratingNote ? (
                    <><SparklesIcon className="h-4 w-4 mr-2 animate-pulse" /> Generating...</>
                  ) : (
                    <><SparklesIcon className="h-4 w-4 mr-2" /> Generate Note</>
                  )}
                </Button>
              </div>
            </div>
            
            <form onSubmit={async (e) => { await handleAddNote(e); if (!errorMessage) handleSuccessfulNoteAdd(); }} className="space-y-6">
              <div>
                <Input
                  placeholder="Note Title"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Note Content (use #, ##, *, -, 1., etc. for formatting)"
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  className="min-h-[160px] bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 font-mono text-sm"
                />
              </div>
              <div>
                <CategoryCombobox 
                  categories={availableCategories}
                  value={newNote.category}
                  onChange={(value) => setNewNote({ ...newNote, category: value })}
                  placeholder="Select or create category..."
                  inputPlaceholder="Search/Create category..."
                  emptyPlaceholder="Type to create new category."
                />
              </div>

              {errorMessage && (
                <div className="text-red-400 text-sm p-3 bg-red-900/40 border border-red-700/60 rounded-md">
                  {errorMessage}
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddNoteDialogOpen(false)} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 border border-neutral-700">
                  {isLoading ? "Adding Note..." : "Add Note"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Chat Dialog */}
      <Dialog open={isAiChatDialogOpen} onOpenChange={setIsAiChatDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <ShadDialogTitle className="text-2xl font-bold text-neutral-100">AI Chat</ShadDialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-md">
                <p className="text-sm text-neutral-400 mb-1">Selected Text:</p>
                <p className="text-neutral-200 font-mono text-sm whitespace-pre-wrap">{selectedText}</p>
              </div>
              
              <div className="flex space-x-2">
                <Input
                  placeholder="Ask a question about this text..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiChatRequest();
                    }
                  }}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 flex-grow"
                  disabled={isProcessingAiRequest}
                />
                <Button 
                  onClick={handleAiChatRequest} 
                  disabled={isProcessingAiRequest || (!aiPrompt.trim() && !selectedText.trim())}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold transition-all duration-150 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 whitespace-nowrap border border-neutral-700"
                >
                  {isProcessingAiRequest ? (
                    <><SparklesIcon className="h-4 w-4 mr-2 animate-pulse" /> Thinking...</>
                  ) : (
                    <><SendIcon className="h-4 w-4 mr-2" /> Ask</>
                  )}
                </Button>
              </div>
              
              {aiResponse && (
                <div className="mt-4">
                  <p className="text-sm text-neutral-400 mb-2">AI Response:</p>
                  <div className="bg-neutral-800/80 border border-neutral-700 rounded-md p-4 max-h-[300px] overflow-y-auto">
                    <div className="prose prose-invert prose-sm max-w-none">
                      {renderNoteContent(aiResponse)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setIsAiChatDialogOpen(false)} 
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-medium border border-neutral-700"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MCQ Dialog */}
      <Dialog open={isMcqDialogOpen} onOpenChange={(isOpen) => {
          setIsMcqDialogOpen(isOpen);
          if (!isOpen) {
              setGeneratedMcqs([]);
              setUserAnswers({});
              setShowMcqResults(false);
              setCurrentMcqNoteTitle(undefined);
          }
      }}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-3xl rounded-xl shadow-2xl p-0 sm:p-0">
          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 sm:p-8">
              <DialogHeader className="mb-6">
                <ShadDialogTitle className="text-2xl font-bold text-neutral-100">
                  Quiz: {currentMcqNoteTitle || "Multiple Choice Questions"}
                </ShadDialogTitle>
                {generatedMcqs.length > 0 && (
                  <DialogDescription className="text-neutral-400">
                    Test your knowledge based on the selected note.
                  </DialogDescription>
                )}
              </DialogHeader>

              {mcqError && (
                <div className="text-red-400 text-sm p-3 bg-red-900/40 border border-red-700/60 rounded-md mb-4">
                  {mcqError}
                </div>
              )}

              {generatedMcqs.length > 0 ? (
                <div className="space-y-6">
                  {generatedMcqs.map((mcq, index) => (
                      <Card key={index} className={`bg-neutral-850 border-neutral-700 p-5 rounded-lg transition-all ${showMcqResults && userAnswers[index] !== mcq.correctAnswer ? 'border-red-500/70' : showMcqResults && userAnswers[index] === mcq.correctAnswer ? 'border-green-500/70' : ''}`}>
                        <CardHeader className="p-0 pb-3 mb-3 border-b border-neutral-700">
                          <CardTitle className="text-lg font-semibold text-neutral-100">
                            Question {index + 1}: {mcq.question}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-2">
                          {mcq.options.map((option: string, optIndex: number) => {
                            const isSelected = userAnswers[index] === option;
                            const isCorrect = option === mcq.correctAnswer;
                            const isUserChoiceIncorrect = isSelected && !isCorrect;
        
                            let optionButtonClasses = "w-full justify-start text-left h-auto py-2.5 px-4 whitespace-normal rounded-md transition-colors duration-150 disabled:opacity-70 disabled:cursor-default border";
        
                            if (showMcqResults) {
                              if (isCorrect) {
                                optionButtonClasses += ' bg-green-500/20 border-green-500/60 text-green-200 hover:bg-green-500/30';
                              } else if (isUserChoiceIncorrect) {
                                optionButtonClasses += ' bg-red-500/20 border-red-500/60 text-red-200 hover:bg-red-500/30';
                              } else {
                                optionButtonClasses += ' bg-neutral-800 border-neutral-700 text-neutral-500 opacity-70 hover:bg-neutral-750'; // Other options during results
                              }
                            } else {
                              // Not showing results yet
                              if (isSelected) {
                                optionButtonClasses += ' bg-neutral-600 border-neutral-500 text-neutral-100 ring-2 ring-neutral-500 hover:bg-neutral-550'; // Selected
                              } else {
                                optionButtonClasses += ' bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-750'; // Default, unselected
                              }
                            }

                            return (
                              <Button
                                key={optIndex}
                                onClick={() => !showMcqResults && handleMcqOptionSelect(index, option)}
                                className={optionButtonClasses}
                                disabled={showMcqResults}
                              >
                                <span className={`mr-3 h-5 w-5 rounded-full flex items-center justify-center border ${
                                  showMcqResults 
                                    ? (option === mcq.correctAnswer ? 'bg-green-500 border-green-400' : (userAnswers[index] === option && option !== mcq.correctAnswer ? 'bg-red-500 border-red-400' : 'border-neutral-600'))
                                    : (userAnswers[index] === option ? 'bg-neutral-500 border-neutral-500' : 'border-neutral-600')
                                }`}>
                                  {showMcqResults && option === mcq.correctAnswer && <CheckCircle2 className="h-3.5 w-3.5 text-white"/>}
                                  {showMcqResults && userAnswers[index] === option && option !== mcq.correctAnswer && <XCircle className="h-3.5 w-3.5 text-white"/>}
                                </span>
                                {option}
                              </Button>
                            );
                          })}
                        </CardContent>
                        {showMcqResults && (
                          <div className={`mt-4 p-3 rounded-md text-sm 
                                      ${userAnswers[index] === mcq.correctAnswer ? 'bg-green-800/50 text-green-200 border border-green-700/60' : 'bg-red-800/50 text-red-200 border border-red-700/60'}`}>
                            <p className="font-semibold mb-1">
                                {userAnswers[index] === mcq.correctAnswer ? "Correct!" : "Incorrect."}
                                {userAnswers[index] !== mcq.correctAnswer && ` Correct answer: ${mcq.correctAnswer}`}
                            </p>
                            {mcq.explanation && <p className="text-xs opacity-90">{mcq.explanation}</p>}
                          </div>
                        )}
                      </Card>
                  ))}
                  
                  {!showMcqResults && generatedMcqs.length > 0 && (
                    <DialogFooter className="mt-8 sm:justify-center">
                      <Button 
                        onClick={handleSubmitMcqs} 
                        disabled={Object.keys(userAnswers).length !== generatedMcqs.length}
                        className="w-full md:w-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-neutral-900 border border-sky-700"
                       >
                         Submit Answers & See Results
                       </Button>
                    </DialogFooter>
                  )}

                  {showMcqResults && (
                    <div className="mt-8 p-5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-center">
                      <h3 className="text-xl font-semibold text-neutral-100 mb-2">Quiz Completed!</h3>
                      <p className="text-neutral-300 mb-1">You scored: <strong className="text-xl">{calculateMcqScore().correct} out of {calculateMcqScore().total}</strong> ({calculateMcqScore().percentage.toFixed(0)}%)</p>
                      {mcqError && <p className="text-xs text-red-400 mt-2">Note: {mcqError}</p>}
                      <Button onClick={() => setIsMcqDialogOpen(false)} className="mt-4 bg-neutral-700 hover:bg-neutral-600 text-neutral-100">Close Quiz</Button>
                    </div>
                  )}
                </div>
              ) : isGeneratingMcqs ? (
                <div className="text-center py-10">
                  <SparklesIcon className="h-12 w-12 text-neutral-500 animate-pulse mx-auto mb-4" />
                  <p className="text-neutral-400">Generating your quiz, please wait...</p>
                </div>
              ) : (
                <div className="text-center py-10">
                   <InfoIcon className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-400">No MCQs to display. {mcqError || "Try generating some from a note."}</p>
                  <Button onClick={() => setIsMcqDialogOpen(false)} className="mt-6 bg-neutral-700 hover:bg-neutral-600 text-neutral-100">Close</Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
