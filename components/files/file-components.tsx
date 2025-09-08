import { useState } from "react"
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
  FolderIcon
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
    <div className="flex items-center p-3 rounded-lg border hover:bg-accent/50">
      <FolderIcon className="h-5 w-5 text-yellow-500 mr-3" />
      <div 
        className="flex-1 min-w-0" 
        onClick={onClick}
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
  onMoveClick
}: { 
  note: any;
  onClick: () => void;
  onMoveClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Card className="group cursor-pointer transition-colors hover:bg-accent/50">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <h3 
            className="font-medium line-clamp-2 text-ellipsis"
            onClick={onClick}
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
  onMoveClick
}: { 
  note: any;
  onClick: () => void;
  onMoveClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center p-3 rounded-lg border hover:bg-accent/50">
      <FileText className="h-5 w-5 text-blue-500 mr-3" />
      <div className="flex-1 min-w-0" onClick={onClick}>
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
