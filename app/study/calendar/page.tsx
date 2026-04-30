"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Target,
  Layers,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Play,
  MoreHorizontal
} from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  eachDayOfInterval,
  getDay
} from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Types
interface CalendarEvent {
  id: string
  type: "exam_session" | "homework" | "due_cards" | "exam_date"
  title: string
  subject: string
  date: string
  duration?: number
  priority: 1 | 2 | 3
  completed: boolean
  deckId?: number
  metadata?: Record<string, unknown>
  color: string
}

interface SubjectStats {
  name: string
  color: string
  totalEvents: number
  completedEvents: number
  upcomingEvents: number
  totalMinutes: number
}

const SUBJECT_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-pink-500",
]

export default function RevisionCalendarPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "agenda">("month")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Fetch all study events
  const fetchEvents = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    const today = new Date().toISOString().split("T")[0]
    const threeMonthsLater = new Date()
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)

    try {
      const [examSessionsRes, homeworkRes, dueCardsRes, examPlansRes] = await Promise.all([
        // Exam plan sessions
        supabase
          .from("exam_plan_sessions")
          .select(`
            id,
            session_date,
            new_target,
            review_target,
            focus,
            estimated_minutes,
            completed_at,
            deck_id,
            decks!inner(name)
          `)
          .eq("user_id", user.id)
          .gte("session_date", today)
          .lte("session_date", threeMonthsLater.toISOString().split("T")[0])
          .order("session_date", { ascending: true }),

        // Homework tasks
        supabase
          .from("homework")
          .select("*")
          .eq("user_id", user.id)
          .eq("done", false)
          .gte("due_date", today)
          .order("due_date", { ascending: true }),

        // Due cards by deck
        supabase
          .from("card_progress")
          .select(`
            card_id,
            due_date,
            cards!inner(deck_id, decks!inner(name))
          `)
          .lte("due_date", threeMonthsLater.toISOString())
          .order("due_date", { ascending: true }),

        // Active exam plans (for exam dates)
        supabase
          .from("exam_plans")
          .select(`
            id,
            exam_date,
            deck_id,
            decks!inner(name)
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .gte("exam_date", today),
      ])

      const calendarEvents: CalendarEvent[] = []
      const subjectColorMap = new Map<string, string>()
      let colorIndex = 0

      // Helper to get or assign color
      const getSubjectColor = (subject: string) => {
        if (!subjectColorMap.has(subject)) {
          subjectColorMap.set(subject, SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length])
          colorIndex++
        }
        return subjectColorMap.get(subject)!
      }

      // Process exam sessions
      if (examSessionsRes.data) {
        examSessionsRes.data.forEach((session: any) => {
          const subject = session.decks?.name || "Unknown Subject"
          calendarEvents.push({
            id: `session-${session.id}`,
            type: "exam_session",
            title: `${session.focus === "learning" ? "Learning" : session.focus === "maintenance" ? "Review" : "Practice"}: ${session.new_target} new, ${session.review_target} review`,
            subject,
            date: session.session_date,
            duration: session.estimated_minutes,
            priority: session.focus === "retrievability" ? 3 : 2,
            completed: !!session.completed_at,
            deckId: session.deck_id,
            color: getSubjectColor(subject),
          })
        })
      }

      // Process homework
      if (homeworkRes.data) {
        homeworkRes.data.forEach((task: any) => {
          const subject = task.subject || "General"
          calendarEvents.push({
            id: `homework-${task.id}`,
            type: "homework",
            title: task.subject,
            subject,
            date: task.due_date,
            priority: task.priority || 2,
            completed: task.done,
            color: getSubjectColor(subject),
            metadata: task.metadata,
          })
        })
      }

      // Process exam dates
      if (examPlansRes.data) {
        examPlansRes.data.forEach((plan: any) => {
          const subject = plan.decks?.name || "Unknown Subject"
          calendarEvents.push({
            id: `exam-${plan.id}`,
            type: "exam_date",
            title: "Exam Date",
            subject,
            date: plan.exam_date,
            priority: 3,
            completed: false,
            deckId: plan.deck_id,
            color: getSubjectColor(subject),
          })
        })
      }

      setEvents(calendarEvents)
    } catch (error) {
      console.error("Error fetching calendar events:", error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, supabase])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Calculate subject stats
  const subjectStats = useMemo(() => {
    const stats = new Map<string, SubjectStats>()

    events.forEach((event) => {
      if (!stats.has(event.subject)) {
        stats.set(event.subject, {
          name: event.subject,
          color: event.color,
          totalEvents: 0,
          completedEvents: 0,
          upcomingEvents: 0,
          totalMinutes: 0,
        })
      }

      const stat = stats.get(event.subject)!
      stat.totalEvents++
      if (event.completed) {
        stat.completedEvents++
      } else {
        stat.upcomingEvents++
      }
      if (event.duration) {
        stat.totalMinutes += event.duration
      }
    })

    return Array.from(stats.values()).sort((a, b) => b.upcomingEvents - a.upcomingEvents)
  }, [events])

  // Calendar navigation
  const navigatePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(addDays(currentDate, -7))
    } else {
      setCurrentDate(addDays(currentDate, -7))
    }
  }

  const navigateNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === "week") {
      setCurrentDate(addDays(currentDate, 7))
    } else {
      setCurrentDate(addDays(currentDate, 7))
    }
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameDay(parseISO(event.date), date))
  }

  // Get upcoming events
  const upcomingEvents = useMemo(() => {
    const today = new Date()
    return events
      .filter((e) => !e.completed && new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10)
  }, [events])

  // Render month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    return (
      <div className="space-y-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const dayEvents = getEventsForDate(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isTodayDate = isToday(day)
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <button
                key={index}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[100px] p-2 text-left rounded-lg border transition-colors",
                  !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                  isCurrentMonth && "bg-card hover:bg-accent",
                  isTodayDate && "ring-2 ring-primary",
                  isSelected && "ring-2 ring-primary bg-accent"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  isTodayDate && "text-primary"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <TooltipProvider key={event.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "text-xs truncate rounded px-1.5 py-0.5",
                              event.color.replace("bg-", "bg-").replace("500", "100"),
                              event.color.replace("bg-", "text-").replace("500", "700"),
                              event.completed && "opacity-50 line-through"
                            )}
                          >
                            {event.subject}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.subject}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Render week view
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayEvents = getEventsForDate(day)
            const isTodayDate = isToday(day)

            return (
              <div key={day.toISOString()} className="space-y-2">
                <div className={cn(
                  "text-center py-2 rounded-lg",
                  isTodayDate ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <div className="text-sm font-medium">{format(day, "EEE")}</div>
                  <div className="text-lg">{format(day, "d")}</div>
                </div>

                <div className="space-y-2 min-h-[200px]">
                  {dayEvents.map((event) => (
                    <Card
                      key={event.id}
                      className={cn(
                        "cursor-pointer hover:shadow-md transition-shadow",
                        event.completed && "opacity-60"
                      )}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", event.color, "text-white")}
                          >
                            {event.subject}
                          </Badge>
                          {event.completed && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        </div>
                        <p className="text-xs font-medium line-clamp-2">{event.title}</p>
                        {event.duration && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {event.duration} min
                          </div>
                        )}
                        {event.deckId && !event.completed && (
                          <Link href={`/deck/${event.deckId}/study`}>
                            <Button size="sm" className="w-full h-7 text-xs">
                              <Play className="h-3 w-3 mr-1" />
                              Study
                            </Button>
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {dayEvents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No sessions
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render agenda view
  const renderAgendaView = () => {
    // Group events by date
    const groupedEvents = upcomingEvents.reduce((acc, event) => {
      const dateKey = event.date
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(event)
      return acc
    }, {} as Record<string, CalendarEvent[]>)

    return (
      <div className="space-y-4">
        {Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date} className="space-y-2">
            <div className="flex items-center gap-3 py-2">
              <div className={cn(
                "w-12 h-12 rounded-lg flex flex-col items-center justify-center",
                isToday(parseISO(date)) ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <span className="text-xs uppercase">{format(parseISO(date), "MMM")}</span>
                <span className="text-lg font-bold">{format(parseISO(date), "d")}</span>
              </div>
              <div>
                <p className="font-medium">{format(parseISO(date), "EEEE")}</p>
                <p className="text-sm text-muted-foreground">
                  {dateEvents.length} session{dateEvents.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-2 pl-[60px]">
              {dateEvents.map((event) => (
                <Card
                  key={event.id}
                  className={cn(
                    "hover:shadow-md transition-shadow",
                    event.completed && "opacity-60"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-white", event.color)}>
                            {event.subject}
                          </Badge>
                          {event.type === "exam_date" && (
                            <Badge variant="destructive">Exam</Badge>
                          )}
                        </div>
                        <p className="font-medium">{event.title}</p>
                        {event.duration && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {event.duration} minutes
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {event.deckId && !event.completed && (
                          <Link href={`/deck/${event.deckId}/study`}>
                            <Button size="sm">
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          </Link>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {}}>
                              Mark complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>
                              Reschedule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {upcomingEvents.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming study sessions</p>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule an exam to see revision sessions here
            </p>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Revision Calendar
          </h1>
          <p className="text-muted-foreground">
            Plan and track your study sessions across all subjects
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subject Legend */}
      {subjectStats.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4" />
              <span className="font-medium">Your Subjects</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {subjectStats.map((subject) => (
                <TooltipProvider key={subject.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={cn("cursor-pointer", subject.color, "text-white")}
                      >
                        {subject.name}
                        <span className="ml-1 opacity-70">
                          ({subject.upcomingEvents} pending)
                        </span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-xs">
                        {subject.upcomingEvents} upcoming · {subject.completedEvents} completed
                      </p>
                      <p className="text-xs">
                        {Math.round(subject.totalMinutes / 60)}h {subject.totalMinutes % 60}m total
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {format(currentDate, "MMMM yyyy")}
                </CardTitle>
                <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
                  <TabsList>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="agenda">Agenda</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {view === "month" && renderMonthView()}
              {view === "week" && renderWeekView()}
              {view === "agenda" && renderAgendaView()}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Study Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{upcomingEvents.length}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{subjectStats.length}</p>
                  <p className="text-xs text-muted-foreground">Subjects</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sessions Done</span>
                  <span className="font-medium">
                    {events.filter((e) => e.completed).length} / {events.length}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${events.length > 0 ? (events.filter((e) => e.completed).length / events.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Events */}
          {selectedDate && view === "month" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, MMM d")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getEventsForDate(selectedDate).map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "p-3 rounded-lg border text-sm",
                      event.completed && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-2 h-2 rounded-full", event.color)} />
                      <span className="font-medium">{event.subject}</span>
                    </div>
                    <p className="text-muted-foreground">{event.title}</p>
                    {event.deckId && !event.completed && (
                      <Link href={`/deck/${event.deckId}/study`}>
                        <Button size="sm" variant="outline" className="w-full mt-2 h-7">
                          <Play className="h-3 w-3 mr-1" />
                          Study Now
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
                {getEventsForDate(selectedDate).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sessions scheduled
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Priority Alert */}
          {upcomingEvents.filter((e) => e.priority === 3 && !e.completed).length > 0 && (
            <Card className="border-amber-500/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">High Priority</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {upcomingEvents.filter((e) => e.priority === 3 && !e.completed).length}{" "}
                      urgent sessions need attention
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
