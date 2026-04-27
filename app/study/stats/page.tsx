"use client"

import React, { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getUserStats, getLearningCurveData, getCardStateDistribution } from "@/lib/stats"
import type { UserStats, LearningCurveDataPoint, CardStateDistribution } from "@/lib/stats"
import { getSubjectDurations, type SubjectDuration, getUserHeatmap, getUserStreak } from "@/lib/activity"
import { AppSidebar } from "@/components/notes/app-sidebar"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { FSRSControls, DEFAULT_FSRS_PARAMS, type FSRSParams } from "@/components/fsrs-controls"
import { useSettings } from "@/context/settings-context"
import { getUpcomingExamSessions, type ExamPlanSession } from "@/lib/exam-data"
import { format, differenceInDays, parseISO } from "date-fns"
import {
    Flame,
    Calendar,
    BookOpen,
    BarChart3,
    Clock,
    Target,
    TrendingUp,
    GraduationCap,
    CheckCircle2,
    Brain,
    Layers
} from "lucide-react"
import Link from "next/link"

interface ExamSessionWithDeck extends ExamPlanSession {
    deck_name: string
}

export default function FSRSStatsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const supabase = createClient()

    const [stats, setStats] = useState<UserStats | null>(null)
    const [learningCurve, setLearningCurve] = useState<LearningCurveDataPoint[]>([])
    const [cardStates, setCardStates] = useState<CardStateDistribution | null>(null)
    const [subjectDurations, setSubjectDurations] = useState<SubjectDuration[]>([])
    const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
    const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number } | null>(null)
    const [upcomingSessions, setUpcomingSessions] = useState<ExamSessionWithDeck[]>([])
    const [activeExamsCount, setActiveExamsCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [days, setDays] = useState(30)

    // FSRS Settings
    const { settings, updateSettings } = useSettings()
    const [fsrsParams, setFsrsParams] = useState<FSRSParams>(DEFAULT_FSRS_PARAMS)

    // Sync FSRS params with global settings
    useEffect(() => {
        if (settings?.studySettings?.fsrsParams) {
            setFsrsParams(settings.studySettings.fsrsParams as FSRSParams)
        }
    }, [settings])

    const handleSaveFsrsParams = async (newParams: FSRSParams) => {
        setFsrsParams(newParams)
        if (settings) {
            await updateSettings({
                ...settings,
                studySettings: {
                    ...settings.studySettings,
                    fsrsParams: newParams
                }
            })
        }
    }

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/")
        }
    }, [user, authLoading, router])

    useEffect(() => {
        async function fetchData() {
            if (!user) return

            setLoading(true)
            try {
                const [userStats, curveData, statesDist, durations, heatmap, streakData, sessions] = await Promise.all([
                    getUserStats(supabase, user.id),
                    getLearningCurveData(supabase, user.id, days),
                    getCardStateDistribution(supabase, user.id),
                    getSubjectDurations(supabase, user.id, days),
                    getUserHeatmap(supabase, user.id),
                    getUserStreak(supabase, user.id),
                    getUpcomingExamSessions(supabase, user.id, 14)
                ])

                setStats(userStats)
                setLearningCurve(curveData)
                setCardStates(statesDist)
                setSubjectDurations(durations)
                setHeatmapData(heatmap)
                setStreak(streakData)
                setUpcomingSessions(sessions)

                // Count unique active exam plans
                const uniquePlans = new Set(sessions.map(s => s.exam_plan_id))
                setActiveExamsCount(uniquePlans.size)
            } catch (error) {
                console.error("Error fetching stats:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user, days, supabase])

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-neutral-900 dark:border-neutral-100 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    // Calculate workload forecast from upcoming sessions
    const workloadData = upcomingSessions.slice(0, 7).map(session => ({
        date: format(parseISO(session.session_date), "EEE"),
        reviews: session.review_target,
        new: session.new_target,
        total: session.review_target + session.new_target
    }))

    // Card state data for bar chart (monochrome)
    const stateData = cardStates ? [
        { name: "Learning", value: cardStates.learning, fill: "#a3a3a3" },
        { name: "Review", value: cardStates.review, fill: "#525252" },
        { name: "Relearning", value: cardStates.relearning, fill: "#262626" },
    ] : []

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-3">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="/study">Study</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Statistics</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <div className="mx-auto w-full max-w-6xl space-y-6">
                        {/* Header */}
                        <div className="flex items-end justify-between">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
                                    Learning Statistics
                                </h1>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    Track progress, exam readiness, and optimize your study schedule.
                                </p>
                            </div>
                            {activeExamsCount > 0 && (
                                <div className="text-right">
                                    <div className="text-sm text-neutral-500">Active Exam Plans</div>
                                    <div className="text-2xl font-semibold">{activeExamsCount}</div>
                                </div>
                            )}
                        </div>

                        {/* Top Stats Row - Monochrome */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <Card className="border-neutral-200 dark:border-neutral-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className="w-4 h-4 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 uppercase tracking-wider">Cards</span>
                                    </div>
                                    <div className="text-2xl font-bold">{stats?.totalCards || 0}</div>
                                    <div className="text-xs text-neutral-400 mt-1">{stats?.totalDecks || 0} decks</div>
                                </CardContent>
                            </Card>

                            <Card className="border-neutral-200 dark:border-neutral-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 uppercase tracking-wider">Due Today</span>
                                    </div>
                                    <div className="text-2xl font-bold">{stats?.cardsDueToday || 0}</div>
                                    <div className="text-xs text-neutral-400 mt-1">need review</div>
                                </CardContent>
                            </Card>

                            <Card className="border-neutral-200 dark:border-neutral-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Brain className="w-4 h-4 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 uppercase tracking-wider">Retention</span>
                                    </div>
                                    <div className="text-2xl font-bold">{((stats?.averageRetentionRate || 0) * 100).toFixed(0)}%</div>
                                    <div className="text-xs text-neutral-400 mt-1">avg recall</div>
                                </CardContent>
                            </Card>

                            <Card className="border-neutral-200 dark:border-neutral-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-4 h-4 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 uppercase tracking-wider">Reviews</span>
                                    </div>
                                    <div className="text-2xl font-bold">{stats?.totalReviews?.toLocaleString() || 0}</div>
                                    <div className="text-xs text-neutral-400 mt-1">total</div>
                                </CardContent>
                            </Card>

                            <Card className="border-neutral-200 dark:border-neutral-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Flame className="w-4 h-4 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 uppercase tracking-wider">Streak</span>
                                    </div>
                                    <div className="text-2xl font-bold">{streak?.currentStreak || 0}</div>
                                    <div className="text-xs text-neutral-400 mt-1">days</div>
                                </CardContent>
                            </Card>

                            <Card className="border-neutral-200 dark:border-neutral-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <GraduationCap className="w-4 h-4 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 uppercase tracking-wider">Sessions</span>
                                    </div>
                                    <div className="text-2xl font-bold">{upcomingSessions.length}</div>
                                    <div className="text-xs text-neutral-400 mt-1">upcoming</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Activity & Heatmap */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Activity Heatmap */}
                                <Card className="border-neutral-200 dark:border-neutral-800">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-neutral-500" />
                                            <CardTitle className="text-base font-medium">Activity Map</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <ActivityHeatmap data={heatmapData} />
                                        <div className="mt-4 flex gap-6 text-sm">
                                            <div>
                                                <span className="text-neutral-500">Current:</span>{" "}
                                                <span className="font-medium">{streak?.currentStreak} days</span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-500">Longest:</span>{" "}
                                                <span className="font-medium">{streak?.longestStreak} days</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Learning Curve */}
                                <Card className="border-neutral-200 dark:border-neutral-800">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="w-4 h-4 text-neutral-500" />
                                                <CardTitle className="text-base font-medium">Learning Curve</CardTitle>
                                            </div>
                                            <select
                                                value={days}
                                                onChange={(e) => setDays(Number(e.target.value))}
                                                className="text-xs border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 bg-transparent"
                                            >
                                                <option value={7}>7 days</option>
                                                <option value={30}>30 days</option>
                                                <option value={90}>90 days</option>
                                            </select>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[200px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={learningCurve}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                                    <XAxis
                                                        dataKey="date"
                                                        tick={{ fontSize: 10 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tickFormatter={(value) => format(new Date(value), "MMM d")}
                                                    />
                                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                                    />
                                                    <Line type="monotone" dataKey="reviews" stroke="#525252" strokeWidth={2} dot={false} name="Reviews" />
                                                    <Line type="monotone" dataKey="newCards" stroke="#a3a3a3" strokeWidth={2} dot={false} name="New" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Card States Distribution */}
                                <Card className="border-neutral-200 dark:border-neutral-800">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-neutral-500" />
                                            <CardTitle className="text-base font-medium">Card States</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[180px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={stateData} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e5e5" />
                                                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <YAxis
                                                        dataKey="name"
                                                        type="category"
                                                        tick={{ fontSize: 11 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        width={70}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                                        formatter={(value: number) => [`${value} cards`, '']}
                                                    />
                                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column - Exam Focus & Settings */}
                            <div className="space-y-6">
                                {/* Upcoming Exam Sessions */}
                                <Card className="border-neutral-200 dark:border-neutral-800">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-2">
                                            <GraduationCap className="w-4 h-4 text-neutral-500" />
                                            <CardTitle className="text-base font-medium">Upcoming Sessions</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {upcomingSessions.length === 0 ? (
                                            <div className="text-sm text-neutral-500 text-center py-6">
                                                No upcoming exam sessions
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {upcomingSessions.slice(0, 5).map((session) => {
                                                    const daysUntil = differenceInDays(parseISO(session.session_date), new Date())
                                                    return (
                                                        <div
                                                            key={session.id}
                                                            className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
                                                        >
                                                            <div>
                                                                <div className="font-medium text-sm">{session.deck_name}</div>
                                                                <div className="text-xs text-neutral-500 mt-0.5">
                                                                    {format(parseISO(session.session_date), "MMM d")} · {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs font-medium">
                                                                    {session.review_target + session.new_target} cards
                                                                </div>
                                                                <span className={`
                                                                    text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block
                                                                    ${session.focus === 'learning' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}
                                                                    ${session.focus === 'maintenance' ? 'bg-neutral-300 dark:bg-neutral-600' : ''}
                                                                    ${session.focus === 'retrievability' ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black' : ''}
                                                                `}>
                                                                    {session.focus}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {upcomingSessions.length > 5 && (
                                                    <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                                                        <Link href="/tasks">View all {upcomingSessions.length} sessions</Link>
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Workload Forecast */}
                                {workloadData.length > 0 && (
                                    <Card className="border-neutral-200 dark:border-neutral-800">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center gap-2">
                                                <Target className="w-4 h-4 text-neutral-500" />
                                                <CardTitle className="text-base font-medium">7-Day Forecast</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[120px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={workloadData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                                        <XAxis
                                                            dataKey="date"
                                                            tick={{ fontSize: 10 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                        <Tooltip
                                                            contentStyle={{ borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                                        />
                                                        <Bar dataKey="reviews" stackId="a" fill="#525252" />
                                                        <Bar dataKey="new" stackId="a" fill="#a3a3a3" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="flex gap-4 mt-3 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-neutral-600"></div>
                                                    <span className="text-neutral-500">Reviews</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                                                    <span className="text-neutral-500">New</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* FSRS Settings */}
                                <Card className="border-neutral-200 dark:border-neutral-800">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-neutral-500" />
                                            <CardTitle className="text-base font-medium">FSRS Settings</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-neutral-500 mb-4">
                                            Customize the spaced repetition algorithm parameters.
                                        </p>
                                        <FSRSControls
                                            params={fsrsParams}
                                            onParamsChange={handleSaveFsrsParams}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
