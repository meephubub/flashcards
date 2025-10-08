import { useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useRouter } from "next/navigation"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatRelativeDate } from "@/lib/utils"
import { 
  CalendarClock, 
  FileText, 
  MoreVertical, 
  FolderInput,
  FolderOpenIcon,
  FolderIcon,
  Trash,
  Pencil
} from "lucide-react"

// Component to render a folder in grid view
export function FolderCard({ 
  name, 
  onClick,
  onMoveClick
}: { 
  name: string; 
  onClick: () => void;
  onMoveClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Card className="group cursor-pointer transition-colors hover:bg-accent/50">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div 
            className="flex-1 flex flex-col items-center text-center"
            onClick={onClick}
          >
            <FolderOpenIcon className="h-12 w-12 text-yellow-500 mb-2 group-hover:text-yellow-600 transition-colors" />
            <p className="font-medium line-clamp-2">{name}</p>
          </div>
          {onMoveClick && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 -mt-2 -mr-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onMoveClick}>
                  <FolderInput className="mr-2 h-4 w-4" />
                  <span>Move to...</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Component to render a folder in list view
export function FolderRow({ 
  name, 
  onClick,
  onMoveClick
}: { 
  name: string; 
  onClick: () => void;
  onMoveClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center p-3 rounded-lg border hover:bg-accent/50 cursor-pointer" onClick={onClick}>
      <FolderIcon className="h-5 w-5 text-yellow-500 mr-3" />
      <div 
        className="flex-1 min-w-0"
      >
        <h3 className="font-medium truncate">{name}</h3>
      </div>
      {onMoveClick && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMoveClick}>
              <FolderInput className="mr-2 h-4 w-4" />
              <span>Move to...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// Component to render a note in grid view
export function NoteCard({ 
  note, 
  onClick,
  onMoveClick,
  onDeleteClick,
  onVerifyClick,
  previewSnippet,
  onHoverStart,
}: { 
  note: any;
  onClick: () => void;
  onMoveClick?: (e: React.MouseEvent) => void;
  onDeleteClick?: (e: React.MouseEvent) => void;
  onVerifyClick?: (e: React.MouseEvent) => void;
  previewSnippet?: string;
  onHoverStart?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [showBelow, setShowBelow] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const showTimerRef = useRef<number | null>(null)
  const clearHideTimer = () => { if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null } }
  const clearShowTimer = () => { if (showTimerRef.current) { window.clearTimeout(showTimerRef.current); showTimerRef.current = null } }
  const scheduleHide = () => { clearHideTimer(); hideTimerRef.current = window.setTimeout(() => setShowPreview(false), 300) }
  const handleMouseEnter = (e: React.MouseEvent) => {
    try {
      const rect = rootRef.current?.getBoundingClientRect()
      // If the top of the card is close to the top of the viewport, show preview below
      setShowBelow((rect?.top ?? 0) < 140)
    } catch {}
    onHoverStart?.()
    clearHideTimer()
    clearShowTimer()
    showTimerRef.current = window.setTimeout(() => setShowPreview(true), 500)
  }
  const handleMouseLeave = () => { scheduleHide(); clearShowTimer() }
  return (
    <Card ref={rootRef} className="group relative cursor-pointer transition-colors hover:bg-accent/50" onClick={onClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Hover preview bubble for note content */}
      {previewSnippet && !showBelow && showPreview && (
        <div
          className="pointer-events-auto absolute left-1/2 -top-2 z-50 -translate-x-1/2 -translate-y-full rounded-md border bg-background p-2 shadow-lg w-72 max-w-[75vw] max-h-80 overflow-auto no-scroll"
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          <div className="prose prose-sm dark:prose-invert">
            <ReactMarkdown>{previewSnippet}</ReactMarkdown>
          </div>
        </div>
      )}
      {previewSnippet && showBelow && showPreview && (
        <div
          className="pointer-events-auto absolute left-1/2 top-full z-50 -translate-x-1/2 mt-2 rounded-md border bg-background p-2 shadow-lg w-72 max-w-[75vw] max-h-80 overflow-auto no-scroll"
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          <div className="prose prose-sm dark:prose-invert">
            <ReactMarkdown>{previewSnippet}</ReactMarkdown>
          </div>
        </div>
      )}
      {/* Scoped styles to hide scrollbars while keeping scroll functionality */}
      <style jsx>{`
        .no-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <h3 
            className="font-medium line-clamp-2 text-ellipsis"
          >
            {note.title || 'Untitled Note'}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 -mt-2 -mr-2"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onMoveClick}>
                <FolderInput className="mr-2 h-4 w-4" />
                <span>Move to...</span>
              </DropdownMenuItem>
              {onVerifyClick && (
                <DropdownMenuItem onClick={onVerifyClick}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Verify</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDeleteClick} className="text-red-600 focus:text-red-600">
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {(note.category || note.project) && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {[note.category, note.project].filter(Boolean).join(' • ')}
          </p>
        )}
        
        {note.updated_at && (
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <CalendarClock className="h-3 w-3 mr-1" />
            <span>{formatRelativeDate(note.updated_at)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Component to render a note in list view
export function NoteRow({ 
  note, 
  onClick,
  onMoveClick,
  onDeleteClick,
  onVerifyClick,
  previewSnippet,
  onHoverStart
}: { 
  note: any;
  onClick: () => void;
  onMoveClick?: (e: React.MouseEvent) => void;
  onDeleteClick?: (e: React.MouseEvent) => void;
  onVerifyClick?: (e: React.MouseEvent) => void;
  previewSnippet?: string;
  onHoverStart?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [showBelow, setShowBelow] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const showTimerRef = useRef<number | null>(null)
  const clearHideTimer = () => { if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null } }
  const clearShowTimer = () => { if (showTimerRef.current) { window.clearTimeout(showTimerRef.current); showTimerRef.current = null } }
  const scheduleHide = () => { clearHideTimer(); hideTimerRef.current = window.setTimeout(() => setShowPreview(false), 300) }
  const handleMouseEnter = (e: React.MouseEvent) => {
    try {
      const rect = rootRef.current?.getBoundingClientRect()
      setShowBelow((rect?.top ?? 0) < 140)
    } catch {}
    onHoverStart?.()
    clearHideTimer()
    clearShowTimer()
    showTimerRef.current = window.setTimeout(() => setShowPreview(true), 200)
  }
  const handleMouseLeave = () => { scheduleHide(); clearShowTimer() }
  return (
    <div ref={rootRef} className="group relative flex items-center p-3 hover:bg-accent/50 cursor-pointer" onClick={onClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {previewSnippet && !showBelow && showPreview && (
        <div
          className="pointer-events-auto absolute left-1/2 -top-2 z-50 -translate-x-1/2 -translate-y-full rounded-md border bg-background p-2 shadow-lg w-[32rem] max-w-[85vw] max-h-80 overflow-auto no-scroll"
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          <div className="prose prose-sm dark:prose-invert">
            <ReactMarkdown>{previewSnippet}</ReactMarkdown>
          </div>
        </div>
      )}
      {previewSnippet && showBelow && showPreview && (
        <div
          className="pointer-events-auto absolute left-1/2 top-full z-50 -translate-x-1/2 mt-2 rounded-md border bg-background p-2 shadow-lg w-[32rem] max-w-[85vw] max-h-80 overflow-auto no-scroll"
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          <div className="prose prose-sm dark:prose-invert">
            <ReactMarkdown>{previewSnippet}</ReactMarkdown>
          </div>
        </div>
      )}
      {/* Scoped styles to hide scrollbars while keeping scroll functionality */}
      <style jsx>{`
        .no-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <FileText className="h-5 w-5 text-blue-500 mr-3" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{note.title || 'Untitled Note'}</h3>
        <div className="flex items-center text-xs text-muted-foreground">
          {note.category && (
            <span className="truncate max-w-[120px]">{note.category}</span>
          )}
          {note.category && note.project && (
            <span className="mx-1">•</span>
          )}
          {note.project && (
            <span className="truncate max-w-[120px]">{note.project}</span>
          )}
        </div>
      </div>
      <div className="flex items-center ml-4">
        {note.updated_at && (
          <span className="text-xs text-muted-foreground mr-3">
            {formatRelativeDate(note.updated_at)}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMoveClick}>
              <FolderInput className="mr-2 h-4 w-4" />
              <span>Move to...</span>
            </DropdownMenuItem>
          {onVerifyClick && (
            <DropdownMenuItem onClick={onVerifyClick}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Verify</span>
            </DropdownMenuItem>
          )}
            <DropdownMenuItem onClick={onDeleteClick} className="text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// Recursive component for folder tree in move dialog
export function FolderTreeItem({ 
  folder, 
  currentFolderId,
  onSelect,
  level = 0 
}: { 
  folder: any;
  currentFolderId: string | null;
  onSelect: (id: string | null) => void;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = folder.children && folder.children.length > 0
  
  return (
    <div>
      <div 
        className={`flex items-center p-2 rounded hover:bg-accent cursor-pointer ${currentFolderId === folder.id ? 'bg-accent' : ''}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {hasChildren ? (
          <button 
            className="mr-2 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <FolderIcon className="h-4 w-4 mr-2 text-yellow-500" />
        <span>{folder.name}</span>
      </div>
      
      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child: any) => (
            <FolderTreeItem 
              key={child.id} 
              folder={child} 
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ onNewNote, onNewFolder }: { onNewNote: () => void, onNewFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
      <FolderOpenIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground mb-1">This folder is empty</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Add notes or create subfolders to get started.
      </p>
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onNewNote}
        >
          <FileText className="mr-2 h-4 w-4" />
          New Note
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={onNewFolder}
        >
          <FolderOpenIcon className="mr-2 h-4 w-4" />
          New Folder
        </Button>
      </div>
    </div>
  )
}

// Storage file components (grid and list)
export function StorageFileCard({ 
  file, 
  onGetUrl,
  onDelete,
  onPreview,
  onClick,
  onHoverStart,
  fileType,
  previewUrl,
  onMoveClick,
  onRenameClick,
  ownedByYou,
}: {
  file: { name: string; updated_at?: string | null };
  onGetUrl: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onPreview?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onHoverStart?: () => void;
  fileType?: string;
  previewUrl?: string | null;
  onMoveClick?: (e: React.MouseEvent) => void;
  onRenameClick?: (e: React.MouseEvent) => void;
  ownedByYou?: boolean | null;
}) {
  return (
    <Card className="group relative cursor-pointer transition-colors hover:bg-accent/50" onClick={onClick} onMouseEnter={onHoverStart}>
      {/* Hover preview bubble for images */}
      {previewUrl && (
        <div className="pointer-events-none absolute left-1/2 -top-2 z-50 hidden -translate-x-1/2 -translate-y-full rounded-md border bg-background p-1 shadow-lg group-hover:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={file.name} className="max-h-40 max-w-64 object-contain" />
        </div>
      )}
      <CardContent className="p-4">
        {typeof ownedByYou === 'boolean' && (
          <div className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-medium ${ownedByYou ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
            {ownedByYou ? 'Owned' : 'Not owned'}
          </div>
        )}
        <div className="flex justify-between items-start">
          <h3 className="font-medium line-clamp-2 text-ellipsis">
            {file.name}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 -mt-2 -mr-2"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMoveClick && (
                <DropdownMenuItem onClick={onMoveClick}>
                  <FolderInput className="mr-2 h-4 w-4" />
                  <span>Move to...</span>
                </DropdownMenuItem>
              )}
              {onRenameClick && (
                <DropdownMenuItem onClick={onRenameClick}>
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>Rename</span>
                </DropdownMenuItem>
              )}
              {onPreview && (
                <DropdownMenuItem onClick={onPreview}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Preview</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onGetUrl}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Get URL</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center">
            {fileType && (
              <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium">
                {fileType}
              </span>
            )}
          </div>
          {file.updated_at && (
            <div className="flex items-center">
              <CalendarClock className="h-3 w-3 mr-1" />
              <span>{formatRelativeDate(file.updated_at)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function StorageFileRow({ 
  file, 
  onGetUrl,
  onDelete,
  onPreview,
  onClick,
  onHoverStart,
  fileType,
  previewUrl,
  onMoveClick,
  onRenameClick,
  ownedByYou,
}: {
  file: { name: string; updated_at?: string | null };
  onGetUrl: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onPreview?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onHoverStart?: () => void;
  fileType?: string;
  previewUrl?: string | null;
  onMoveClick?: (e: React.MouseEvent) => void;
  onRenameClick?: (e: React.MouseEvent) => void;
  ownedByYou?: boolean | null;
}) {
  return (
    <div className="group relative flex items-center p-3 hover:bg-accent/50" onClick={onClick} onMouseEnter={onHoverStart}>
      {previewUrl && (
        <div className="pointer-events-none absolute left-1/2 -top-2 z-50 hidden -translate-x-1/2 -translate-y-full rounded-md border bg-background p-1 shadow-lg group-hover:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={file.name} className="max-h-40 max-w-64 object-contain" />
        </div>
      )}
      <FileText className="h-5 w-5 text-emerald-500 mr-3" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{file.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {fileType && (
            <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium">
              {fileType}
            </span>
          )}
          {file.updated_at && (
            <span>{formatRelativeDate(file.updated_at)}</span>
          )}
          {typeof ownedByYou === 'boolean' && (
            <span className={`ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${ownedByYou ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              {ownedByYou ? 'Owned' : 'Not owned'}
            </span>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onMoveClick && (
            <DropdownMenuItem onClick={onMoveClick}>
              <FolderInput className="mr-2 h-4 w-4" />
              <span>Move to...</span>
            </DropdownMenuItem>
          )}
          {onRenameClick && (
            <DropdownMenuItem onClick={onRenameClick}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>
          )}
          {onPreview && (
            <DropdownMenuItem onClick={onPreview}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Preview</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onGetUrl}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Get URL</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
