"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChevronDown, ChevronRight, RotateCcw, HelpCircle, Info } from "lucide-react"

export interface FSRSParams {
    request_retention: number
    maximum_interval: number
    w?: number[]
}

interface FSRSControlsProps {
    params: FSRSParams
    onParamsChange: (params: FSRSParams) => void
    defaultParams?: FSRSParams
}

export const DEFAULT_FSRS_PARAMS: FSRSParams = {
    request_retention: 0.9,
    maximum_interval: 36500,
    w: [
        0.40255, 1.18385, 3.173, 15.69105, 7.19605, 0.5345, 1.4604, 0.0046, 1.54575,
        0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2711, 0.28755, 2.9748, 0.43255,
        0.5529,
    ],
}

// FSRS weight descriptions based on algorithm documentation
const WEIGHT_DESCRIPTIONS: Record<number, { name: string; description: string }> = {
    0: { name: "S0(Again)", description: "Initial stability after 'Again' rating (failed review)" },
    1: { name: "S0(Hard)", description: "Initial stability after 'Hard' rating" },
    2: { name: "S0(Good)", description: "Initial stability after 'Good' rating" },
    3: { name: "S0(Easy)", description: "Initial stability after 'Easy' rating" },
    4: { name: "C0", description: "Initial difficulty/cost parameter for new cards" },
    5: { name: "F0", description: "Short-term memory base factor" },
    6: { name: "F1", description: "Short-term memory scaling factor" },
    7: { name: "S(Short)", description: "Stability increase factor for short intervals" },
    8: { name: "S(Long)", description: "Stability increase factor for long intervals" },
    9: { name: "D0", description: "Difficulty decay factor for successful reviews" },
    10: { name: "D1", description: "Difficulty sensitivity to rating" },
    11: { name: "D2", description: "Difficulty base offset" },
    12: { name: "R0", description: "Retrievability threshold for stability increase" },
    13: { name: "R1", description: "Retrievability sensitivity factor" },
    14: { name: "S(Fail)", description: "Stability decay factor after failed review" },
    15: { name: "S(Relearn)", description: "Stability recovery factor during relearning" },
    16: { name: "S(Max)", description: "Maximum stability increase cap" },
    17: { name: "ST0", description: "Short-term memory retention factor" },
    18: { name: "ST1", description: "Short-term memory decay factor" },
}

export function FSRSControls({
    params,
    onParamsChange,
    defaultParams = DEFAULT_FSRS_PARAMS,
}: FSRSControlsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [weightsInput, setWeightsInput] = useState("")
    const [weightsError, setWeightsError] = useState<string | null>(null)
    const [showWeightHelp, setShowWeightHelp] = useState(false)

    // Initialize weights input from params
    useEffect(() => {
        if (params.w) {
            setWeightsInput(params.w.join(", "))
        } else if (defaultParams.w) {
            setWeightsInput(defaultParams.w.join(", "))
        }
    }, [params.w, defaultParams.w])

    const handleWeightChange = (value: string) => {
        setWeightsInput(value)
        setWeightsError(null)

        // Try to parse weights
        const weights = value
            .split(",")
            .map((s) => parseFloat(s.trim()))
            .filter((n) => !isNaN(n))

        if (weights.length !== 19) {
            setWeightsError(`Expected 19 weights, got ${weights.length}`)
            return
        }

        onParamsChange({
            ...params,
            w: weights,
        })
    }

    const handleResetWeights = () => {
        if (defaultParams.w) {
            setWeightsInput(defaultParams.w.join(", "))
            setWeightsError(null)
            onParamsChange({
                ...params,
                w: defaultParams.w,
            })
        }
    }

    const retentionPercent = Math.round(params.request_retention * 100)

    return (
        <TooltipProvider delayDuration={100}>
            <div className="space-y-6">
                {/* Request Retention */}
                <div className="space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="fsrs-retention" className="font-medium">
                                Target Retention
                            </Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-neutral-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                    <p className="text-xs leading-relaxed">
                                        The percentage of cards FSRS will aim to have you remember correctly. 
                                        Higher values (90%+) mean more frequent reviews to maintain better recall. 
                                        Lower values (80-85%) reduce daily review load but increase forgetting.
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-2">
                                        Recommended: 85-90% for most learners
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="text-sm font-medium tabular-nums">{retentionPercent}%</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-neutral-400 w-8">70%</span>
                        <Slider
                            id="fsrs-retention"
                            min={0.7}
                            max={0.99}
                            step={0.01}
                            value={[params.request_retention]}
                            onValueChange={(value) =>
                                onParamsChange({
                                    ...params,
                                    request_retention: value[0],
                                })
                            }
                            className="flex-1"
                        />
                        <span className="text-xs text-neutral-400 w-10">99%</span>
                    </div>

                    <div className="flex gap-2 text-xs">
                        <span className={`px-2 py-1 rounded ${retentionPercent < 85 ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600' : ''}`}>
                            Lower workload
                        </span>
                        <span className={`px-2 py-1 rounded ${retentionPercent >= 85 && retentionPercent <= 90 ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100' : ''}`}>
                            Balanced
                        </span>
                        <span className={`px-2 py-1 rounded ${retentionPercent > 90 ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black' : ''}`}>
                            Higher retention
                        </span>
                    </div>
                </div>

                {/* Maximum Interval */}
                <div className="space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="fsrs-max-interval" className="font-medium">
                                Maximum Interval
                            </Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-neutral-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                    <p className="text-xs leading-relaxed">
                                        The longest time FSRS will schedule between reviews. 
                                        Even if the algorithm calculates a longer interval, 
                                        it will be capped at this value.
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-2">
                                        Default: ~100 years (effectively unlimited)
                                        <br />
                                        For exams: Consider 30-90 days before exam date
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                            {params.maximum_interval >= 365 ? `${Math.round(params.maximum_interval / 365)}y` : `${params.maximum_interval}d`}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-xs text-neutral-400 w-8">30d</span>
                        <Slider
                            id="fsrs-max-interval"
                            min={30}
                            max={3650}
                            step={30}
                            value={[Math.min(params.maximum_interval, 3650)]}
                            onValueChange={(value) =>
                                onParamsChange({
                                    ...params,
                                    maximum_interval: value[0],
                                })
                            }
                            className="flex-1"
                        />
                        <span className="text-xs text-neutral-400 w-10">10y</span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {[30, 90, 180, 365, 730, 3650].map((days) => (
                            <Button
                                key={days}
                                variant="ghost"
                                size="sm"
                                className={`text-xs h-7 px-2 ${params.maximum_interval === days ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`}
                                onClick={() => onParamsChange({ ...params, maximum_interval: days })}
                            >
                                {days >= 365 ? `${days / 365}y` : `${days}d`}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Advanced Weights */}
                <Collapsible
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    className="border rounded-lg overflow-hidden"
                >
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            className="flex w-full justify-between px-4 py-3 h-auto hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        >
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-neutral-500" />
                                <span className="font-medium text-sm">Advanced: FSRS Weights</span>
                            </div>
                            {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-neutral-400" />
                            )}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 space-y-4">
                        <div className="text-xs text-neutral-500 leading-relaxed bg-neutral-50 dark:bg-neutral-900 p-3 rounded">
                            <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">About FSRS Weights</p>
                            <p>
                                The 19 weights are machine learning parameters that control how FSRS calculates 
                                card stability and schedules reviews. They are typically optimized from your 
                                review history using the FSRS optimizer. Only modify if you understand the algorithm.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="fsrs-weights" className="text-xs font-medium">
                                    Weights (comma separated, 19 values)
                                </Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setShowWeightHelp(!showWeightHelp)}
                                    >
                                        {showWeightHelp ? "Hide" : "Show"} Help
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={handleResetWeights}
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Reset
                                    </Button>
                                </div>
                            </div>
                            <Input
                                id="fsrs-weights"
                                value={weightsInput}
                                onChange={(e) => handleWeightChange(e.target.value)}
                                className={`font-mono text-xs ${weightsError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                placeholder="0.40255, 1.18385, 3.173, ..."
                            />
                            {weightsError ? (
                                <p className="text-xs text-red-500">{weightsError}</p>
                            ) : (
                                <p className="text-xs text-neutral-500">
                                    {params.w ? `${params.w.length} weights configured` : "Using defaults"}
                                </p>
                            )}
                        </div>

                        {/* Weight Help Table */}
                        {showWeightHelp && (
                            <div className="border rounded overflow-hidden">
                                <div className="bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs font-medium">
                                    Weight Reference (w[0] to w[18])
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {Array.from({ length: 19 }, (_, i) => (
                                                <tr key={i} className="border-b last:border-0">
                                                    <td className="px-3 py-1.5 w-12 text-neutral-500 font-mono">w[{i}]</td>
                                                    <td className="px-3 py-1.5 w-20 font-medium">
                                                        {WEIGHT_DESCRIPTIONS[i]?.name || `Param ${i}`}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-neutral-500">
                                                        {WEIGHT_DESCRIPTIONS[i]?.description || "Algorithm parameter"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </TooltipProvider>
    )
}
