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
import { Card } from "@/components/ui/card"
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { FSRSControls, DEFAULT_FSRS_PARAMS, type FSRSParams } from "@/components/fsrs-controls"
import { useSettings } from "@/context/settings-context"
import { Flame, Calendar, BookOpen, BarChart3, Clock, Target } from "lucide-react"

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
                const [userStats, curveData, statesDist, durations, heatmap, streakData] = await Promise.all([
                    getUserStats(supabase, user.id),
                    getLearningCurveData(supabase, user.id, days),
                    getCardStateDistribution(supabase, user.id),
                    getSubjectDurations(supabase, user.id, days),
                    getUserHeatmap(supabase, user.id),
                    getUserStreak(supabase, user.id)
                ])

                setStats(userStats)
                setLearningCurve(curveData)
                setCardStates(statesDist)
                setSubjectDurations(durations)
                setHeatmapData(heatmap)
                setStreak(streakData)
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
                <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    const pieData = cardStates
        ? [
            { name: "Learning", value: cardStates.learning, color: "#3b82f6" },
            { name: "Review", value: cardStates.review, color: "#10b981" },
            { name: "Relearning", value: cardStates.relearning, color: "#f59e0b" },
        ]
        : []

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
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
                                Learning Statistics
                            </h1>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Track your progress, consistency, and optimization.
                            </p>
                        </div>

                        {/* Top Stats Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="p-4 border border-black/5 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-neutral-500 dark:text-neutral-400">Total Cards</div>
                                        <div className="text-2xl font-bold">{stats?.totalCards || 0}</div>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 border border-black/5 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-neutral-500 dark:text-neutral-400">Due Today</div>
                                        <div className="text-2xl font-bold">{stats?.cardsDueToday || 0}</div>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 border border-black/5 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                        <Target className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-neutral-500 dark:text-neutral-400">Retention</div>
                                        <div className="text-2xl font-bold">{((stats?.averageRetentionRate || 0) * 100).toFixed(0)}%</div>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-4 border border-black/5 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
                                        <Flame className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-neutral-500 dark:text-neutral-400">Streak</div>
                                        <div className="text-2xl font-bold">{streak?.currentStreak || 0} <span className="text-xs font-normal text-neutral-400">days</span></div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Heatmap Section */}
                        <Card className="p-6 border border-black/5 dark:border-white/5 bg-white dark:bg-neutral-900 shadow-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <Calendar className="w-5 h-5 text-neutral-500" />
                                <h2 className="text-lg font-semibold">Activity Map</h2>
                            </div>
                            <ActivityHeatmap data={heatmapData} />
                            <div className="mt-4 flex gap-6 text-sm text-neutral-500">
                                <div>Current Streak: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{streak?.currentStreak} days</span></div>
                                <div>Longest Streak: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{streak?.longestStreak} days</span></div>
                            </div>
                        </Card>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Learning Curve */}
                            <Card className="p-6 border border-black/5 dark:border-white/5 bg-white dark:bg-neutral-900 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-neutral-500" />
                                        <h2 className="text-lg font-semibold">Learning Curve</h2>
                                    </div>
                                    <select
                                        value={days}
                                        onChange={(e) => setDays(Number(e.target.value))}
                                        className="text-xs font-medium border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 bg-neutral-50 dark:bg-neutral-900 outline-none focus:ring-2 focus:ring-black/5"
                                    >
                                        <option value={7}>Last 7 days</option>
                                        <option value={30}>Last 30 days</option>
                                        <option value={90}>Last 90 days</option>
                                    </select>
                                </div>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={learningCurve}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.5} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10, fill: '#888' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickMargin={10}
                                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        />
                                        <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            labelStyle={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="reviews" stroke="#3b82f6" strokeWidth={2} dot={false} name="Reviews" />
                                        <Line type="monotone" dataKey="newCards" stroke="#10b981" strokeWidth={2} dot={false} name="New Cards" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Card State Distribution */}
                            <Card className="p-6 border border-black/5 dark:border-white/5 bg-white dark:bg-neutral-900 shadow-sm">
                                <h2 className="text-lg font-semibold mb-6">Card States</h2>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                                    <div className="w-[180px] h-[180px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {pieData.map((item) => (
                                            <div key={item.name} className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                ></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{item.name}</span>
                                                    <span className="text-xs text-neutral-500">{item.value} cards</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>

                            {/* Time Spent Chart */}
                            <Card className="p-6 border border-black/5 dark:border-white/5 bg-white dark:bg-neutral-900 shadow-sm col-span-1 lg:col-span-2">
                                <h2 className="text-lg font-semibold mb-6">Time Spent by Subject</h2>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={subjectDurations.map(d => ({ ...d, minutes: Math.round(d.duration_seconds / 60) }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.5} />
                                            <XAxis dataKey="subject_name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickMargin={10} />
                                            <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                formatter={(value: number) => [`${value} mins`, 'Time']}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Line type="monotone" dataKey="minutes" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} name="Time (mins)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>

                        {/* FSRS Settings Panel */}
                        <Card className="p-6 border border-black/10 dark:border-white/10">
                            <h2 className="text-lg font-semibold mb-2">FSRS Settings</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                                Customize the FSRS spaced repetition algorithm parameters. These settings apply globally to all your study sessions.
                            </p>
                            <FSRSControls
                                params={fsrsParams}
                                onParamsChange={handleSaveFsrsParams}
                            />
                        </Card>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
