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
import { motion } from "framer-motion"

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

import { StudyMode, STUDY_MODE_PARAMS } from "@/lib/settings"

export function FSRSControls({
    params,
    onParamsChange,
    defaultParams = DEFAULT_FSRS_PARAMS,
}: FSRSControlsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [weightsInput, setWeightsInput] = useState("")
    const [weightsError, setWeightsError] = useState<string | null>(null)
    const [showWeightHelp, setShowWeightHelp] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)

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

    const setStudyMode = (mode: StudyMode) => {
        const modeParams = STUDY_MODE_PARAMS[mode];
        onParamsChange({
            ...params,
            ...modeParams
        });
    }

    const retentionPercent = Math.round(params.request_retention * 100)

    return (
        <TooltipProvider delayDuration={100}>
            <div className="space-y-8">
                {/* Study Mode Selector */}
                <div className="space-y-4">
                    <Label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Revision Intensity</Label>
                    <div className="grid grid-cols-3 gap-3">
                        {(["chill", "normal", "exam"] as StudyMode[]).map((mode) => (
                            <Button
                                key={mode}
                                variant={params.request_retention === STUDY_MODE_PARAMS[mode].request_retention && params.maximum_interval === STUDY_MODE_PARAMS[mode].maximum_interval ? "default" : "outline"}
                                className="flex flex-col h-20 rounded-2xl gap-1 transition-all"
                                onClick={() => setStudyMode(mode)}
                            >
                                <span className="capitalize font-bold">{mode}</span>
                                <span className="text-[10px] opacity-70">
                                    {mode === "chill" && "Lower workload"}
                                    {mode === "normal" && "Balanced"}
                                    {mode === "exam" && "Maximum recall"}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="pt-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
                    </Button>
                </div>

                {showAdvanced && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 pt-4 border-t border-zinc-100 dark:border-zinc-800"
                    >
                        {/* Request Retention */}
                        <div className="space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="fsrs-retention" className="font-medium text-sm">
                                        Target Retention
                                    </Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <HelpCircle className="h-4 w-4 text-neutral-400 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs">
                                            <p className="text-xs leading-relaxed">
                                                The percentage of cards FSRS will aim to have you remember correctly. 
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <span className="text-sm font-medium tabular-nums">{retentionPercent}%</span>
                            </div>
                            
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
                            />
                        </div>

                        {/* Maximum Interval */}
                        <div className="space-y-3">
                            <div className="flex items-start justify-between">
                                <Label htmlFor="fsrs-max-interval" className="font-medium text-sm">
                                    Maximum Interval
                                </Label>
                                <span className="text-sm font-medium tabular-nums">
                                    {params.maximum_interval >= 365 ? `${Math.round(params.maximum_interval / 365)}y` : `${params.maximum_interval}d`}
                                </span>
                            </div>

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
                            />
                        </div>

                        {/* Advanced Weights */}
                        <Collapsible
                            open={isOpen}
                            onOpenChange={setIsOpen}
                            className="border rounded-xl overflow-hidden"
                        >
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="flex w-full justify-between px-4 py-3 h-auto hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                >
                                    <div className="flex items-center gap-2">
                                        <Info className="h-4 w-4 text-neutral-500" />
                                        <span className="font-medium text-sm">FSRS Weights</span>
                                    </div>
                                    {isOpen ? (
                                        <ChevronDown className="h-4 w-4 text-neutral-400" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-4 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="fsrs-weights" className="text-xs font-medium">
                                            Weights (comma separated, 19 values)
                                        </Label>
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
                                    <Input
                                        id="fsrs-weights"
                                        value={weightsInput}
                                        onChange={(e) => handleWeightChange(e.target.value)}
                                        className={`font-mono text-xs ${weightsError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                    />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </motion.div>
                )}
            </div>
        </TooltipProvider>
    )
}

