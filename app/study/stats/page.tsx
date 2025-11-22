"use client"

import React, { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getUserStats, getLearningCurveData, getCardStateDistribution } from "@/lib/stats"
import type { UserStats, LearningCurveDataPoint, CardStateDistribution } from "@/lib/stats"
import { AppSidebar } from "@/components/notes/app-sidebar"
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

export default function FSRSStatsPage() {
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()
    const supabase = createClient()

    const [stats, setStats] = useState<UserStats | null>(null)
    const [learningCurve, setLearningCurve] = useState<LearningCurveDataPoint[]>([])
    const [cardStates, setCardStates] = useState<CardStateDistribution | null>(null)
    const [loading, setLoading] = useState(true)
    const [days, setDays] = useState(30)

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
                const [userStats, curveData, statesDist] = await Promise.all([
                    getUserStats(supabase, user.id),
                    getLearningCurveData(supabase, user.id, days),
                    getCardStateDistribution(supabase, user.id),
                ])

                setStats(userStats)
                setLearningCurve(curveData)
                setCardStates(statesDist)
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
                                    <BreadcrumbPage>FSRS Statistics</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <div className="mx-auto w-full max-w-6xl">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
                                Learning Statistics
                            </h1>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Track your progress and optimize your spaced repetition learning
                            </p>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <Card className="p-4 border border-black/10 dark:border-white/10">
                                <div className="text-sm text-neutral-500 dark:text-neutral-400">Total Cards</div>
                                <div className="text-3xl font-bold mt-1">{stats?.totalCards || 0}</div>
                            </Card>
                            <Card className="p-4 border border-black/10 dark:border-white/10">
                                <div className="text-sm text-neutral-500 dark:text-neutral-400">Due Today</div>
                                <div className="text-3xl font-bold mt-1">{stats?.cardsDueToday || 0}</div>
                            </Card>
                            <Card className="p-4 border border-black/10 dark:border-white/10">
                                <div className="text-sm text-neutral-500 dark:text-neutral-400">Studied Today</div>
                                <div className="text-3xl font-bold mt-1">{stats?.cardsStudiedToday || 0}</div>
                            </Card>
                            <Card className="p-4 border border-black/10 dark:border-white/10">
                                <div className="text-sm text-neutral-500 dark:text-neutral-400">Retention Rate</div>
                                <div className="text-3xl font-bold mt-1">
                                    {((stats?.averageRetentionRate || 0) * 100).toFixed(0)}%
                                </div>
                            </Card>
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Learning Curve */}
                            <Card className="p-6 border border-black/10 dark:border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold">Learning Curve</h2>
                                    <select
                                        value={days}
                                        onChange={(e) => setDays(Number(e.target.value))}
                                        className="text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-white dark:bg-neutral-900"
                                    >
                                        <option value={7}>7 days</option>
                                        <option value={30}>30 days</option>
                                        <option value={90}>90 days</option>
                                    </select>
                                </div>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={learningCurve}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="reviews" stroke="#3b82f6" name="Reviews" />
                                        <Line type="monotone" dataKey="newCards" stroke="#10b981" name="New Cards" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Card State Distribution */}
                            <Card className="p-6 border border-black/10 dark:border-white/10">
                                <h2 className="text-lg font-semibold mb-4">Card States</h2>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {pieData.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                ></div>
                                                <span>{item.name}</span>
                                            </div>
                                            <span className="font-medium">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* FSRS Settings Panel */}
                        <Card className="p-6 border border-black/10 dark:border-white/10">
                            <h2 className="text-lg font-semibold mb-4">FSRS Settings</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                                Advanced FSRS parameter customization coming soon. The default settings are optimized for most users.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-neutral-600 dark:text-neutral-400 block mb-1">
                                        Request Retention (Target)
                                    </label>
                                    <div className="text-lg font-medium">90%</div>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        The desired percentage of information you want to retain
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-neutral-600 dark:text-neutral-400 block mb-1">
                                        Maximum Interval
                                    </label>
                                    <div className="text-lg font-medium">36500 days</div>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        Maximum number of days between reviews
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
