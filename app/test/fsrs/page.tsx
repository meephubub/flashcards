"use client"

import { useState, useMemo } from "react"
import { fsrs, Rating, createEmptyCard, type Card as FsrsCard, type RecordLog, State } from "ts-fsrs"
import { getNextReviewText, type CardProgress } from "@/lib/spaced-repetition"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RotateCcw, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function FSRSTestPage() {
    const [retention, setRetention] = useState(0.9)
    const [maxInterval, setMaxInterval] = useState(36500)

    const scheduler = useMemo(() => fsrs({
        enable_fuzz: false,
        request_retention: retention,
        maximum_interval: maxInterval,
    }), [retention, maxInterval])

    const [card, setCard] = useState<FsrsCard>(createEmptyCard())
    const [history, setHistory] = useState<{ card: FsrsCard, log: RecordLog, ratingText: string }[]>([])

    const ratingMap = [
        { rating: Rating.Again, label: "Again", color: "destructive" },
        { rating: Rating.Hard, label: "Hard", color: "secondary" },
        { rating: Rating.Good, label: "Good", color: "default" },
        { rating: Rating.Easy, label: "Easy", color: "outline" },
    ]

    const handleRate = (rating: Rating, label: string) => {
        const now = new Date()
        const result = scheduler.next(card, now, rating)
        setHistory([...history, { card: { ...card }, log: result.log, ratingText: label }])
        setCard(result.card)
    }

    const reset = () => {
        setCard(createEmptyCard())
        setHistory([])
    }

    const resetParams = () => {
        setRetention(0.9)
        setMaxInterval(36500)
    }

    const stateToString = (state: State) => {
        switch (state) {
            case State.New: return "New"
            case State.Learning: return "Learning"
            case State.Review: return "Review"
            case State.Relearning: return "Relearning"
            default: return "Unknown"
        }
    }

    // Prepare preview for all ratings
    const previews = useMemo(() => {
        return scheduler.repeat(card, new Date())
    }, [card, scheduler])

    return (
        <div className="container mx-auto py-10 px-4 max-w-6xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">FSRS Protocol Explorer</h1>
                    <p className="text-muted-foreground mt-1">
                        Direct interaction with the <code className="bg-muted px-1 rounded">ts-fsrs</code> library.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={resetParams}>
                        Reset Settings
                    </Button>
                    <Button variant="outline" size="sm" onClick={reset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Card
                    </Button>
                </div>
            </div>

            {/* Settings Card */}
            <Card className="mb-8 bg-muted/30">
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium">Algorithm Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8 py-2">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="retention">Requested Retention: <span className="font-mono font-bold text-primary">{(retention * 100).toFixed(0)}%</span></Label>
                        </div>
                        <Slider 
                            id="retention"
                            min={0.7} 
                            max={0.99} 
                            step={0.01} 
                            value={[retention]} 
                            onValueChange={(v) => setRetention(v[0])}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Higher retention (e.g., 0.95) increases review frequency for better long-term memory.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <Label htmlFor="maxInterval">Maximum Interval (Days)</Label>
                        <Input 
                            id="maxInterval"
                            type="number"
                            value={maxInterval}
                            onChange={(e) => setMaxInterval(Number(e.target.value))}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Caps how far into the future any card can be scheduled. Default is 36,500 days.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6 mb-8">
                {/* Current Card State */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Current Card</CardTitle>
                        <CardDescription>Internal state of the card</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">State:</span>
                                <span className="font-mono font-bold">{stateToString(card.state)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Stability (S):</span>
                                <span className="font-mono">{Number(card.stability).toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Difficulty (D):</span>
                                <span className="font-mono">{Number(card.difficulty).toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Retrievability (R):</span>
                                <span className="font-mono">
                                    {Number(scheduler.get_retrievability(card, new Date(), false) || 0).toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2 mt-2">
                                <span className="text-muted-foreground">Interval:</span>
                                <span className="font-bold">{card.scheduled_days} days</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Reps:</span>
                                <span>{card.reps}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Lapses:</span>
                                <span>{card.lapses}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Rating Actions */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Next Review Outcomes</CardTitle>
                        <CardDescription>How each rating would affect the card</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {ratingMap.map((r) => {
                                const outcome = previews[r.rating]
                                // Mock a CardProgress for getNextReviewText
                                const mockProgress: CardProgress = {
                                    dueDate: outcome.card.due.toISOString(),
                                    interval: outcome.card.scheduled_days,
                                    repetitions: outcome.card.reps,
                                    lastReviewed: new Date().toISOString(),
                                    easeFactor: 2.5
                                }
                                
                                return (
                                    <div key={r.rating} className="flex flex-col gap-2">
                                        <Button 
                                            variant={r.color as any}
                                            className="w-full h-16 flex flex-col items-center justify-center"
                                            onClick={() => handleRate(r.rating, r.label)}
                                        >
                                            <span className="font-bold">{r.label}</span>
                                            <span className="text-[10px] opacity-70">Grade {r.rating}</span>
                                        </Button>
                                        <div className="bg-muted/50 p-2 rounded text-[10px] space-y-1">
                                            <div className="flex justify-between">
                                                <span>Next S:</span>
                                                <span className="font-mono">{Number(outcome.card.stability).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Next I:</span>
                                                <span className="font-bold">{outcome.card.scheduled_days}d</span>
                                            </div>
                                            <div className="text-center pt-1 border-t border-muted-foreground/20 text-primary font-medium">
                                                {getNextReviewText(mockProgress)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Review Transaction Log</CardTitle>
                    <CardDescription>Step-by-step evolution of the card state</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">Step</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>State Transition</TableHead>
                                <TableHead>Interval</TableHead>
                                <TableHead>Stability</TableHead>
                                <TableHead>Difficulty</TableHead>
                                <TableHead>Review Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                        No reviews recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {history.map((h, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-mono text-xs">#{i + 1}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            h.log.rating === Rating.Again ? 'bg-red-100 text-red-700' : 
                                            h.log.rating === Rating.Hard ? 'bg-orange-100 text-orange-700' :
                                            h.log.rating === Rating.Good ? 'bg-blue-100 text-blue-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {h.ratingText}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <span className="text-muted-foreground">{stateToString(h.log.state)}</span>
                                        <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                                        <span className="font-medium">{stateToString(h.card.state)}</span>
                                    </TableCell>
                                    <TableCell className="text-xs font-bold">
                                        {h.log.scheduled_days}d
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {Number(h.log.stability).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {Number(h.log.difficulty).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-[10px] text-muted-foreground">
                                        {h.log.review.toLocaleTimeString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {history.length > 0 && (
                                <TableRow className="bg-primary/5">
                                    <TableCell className="font-bold">NOW</TableCell>
                                    <TableCell colSpan={2} className="text-xs font-medium text-primary">
                                        Final Card Status
                                    </TableCell>
                                    <TableCell className="font-bold text-primary">{card.scheduled_days}d</TableCell>
                                    <TableCell className="font-mono text-xs">{Number(card.stability).toFixed(2)}</TableCell>
                                    <TableCell className="font-mono text-xs">{Number(card.difficulty).toFixed(2)}</TableCell>
                                    <TableCell className="text-xs font-bold text-primary">
                                        {getNextReviewText({
                                            dueDate: card.due.toISOString(),
                                            interval: card.scheduled_days,
                                            repetitions: card.reps,
                                            lastReviewed: new Date().toISOString(),
                                            easeFactor: 2.5
                                        })}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

function ArrowRight(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}
