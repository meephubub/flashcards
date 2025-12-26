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
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react"

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

export function FSRSControls({
    params,
    onParamsChange,
    defaultParams = DEFAULT_FSRS_PARAMS,
}: FSRSControlsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [weightsInput, setWeightsInput] = useState("")
    const [weightsError, setWeightsError] = useState<string | null>(null)

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

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex justify-between">
                    <Label htmlFor="fsrs-retention">
                        Target Retention: {params.request_retention}
                    </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    The desired percentage of information you want to retain. Higher values
                    mean more frequent reviews.
                </p>
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
                    className="py-4"
                />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between">
                    <Label htmlFor="fsrs-max-interval">
                        Maximum Interval: {params.maximum_interval} days
                    </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    The maximum number of days between reviews.
                </p>
                <Slider
                    id="fsrs-max-interval"
                    min={30}
                    max={36500}
                    step={30}
                    value={[params.maximum_interval]}
                    onValueChange={(value) =>
                        onParamsChange({
                            ...params,
                            maximum_interval: value[0],
                        })
                    }
                    className="py-4"
                />
            </div>

            <Collapsible
                open={isOpen}
                onOpenChange={setIsOpen}
                className="border rounded-md p-4"
            >
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className="flex w-full justify-between p-0 hover:bg-transparent"
                    >
                        <span className="font-medium">Advanced: FSRS Weights</span>
                        {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="fsrs-weights" className="text-xs">
                                Weights (comma separated)
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={handleResetWeights}
                            >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reset Defaults
                            </Button>
                        </div>
                        <Input
                            id="fsrs-weights"
                            value={weightsInput}
                            onChange={(e) => handleWeightChange(e.target.value)}
                            className={`font-mono text-xs ${weightsError ? "border-red-500 focus-visible:ring-red-500" : ""
                                }`}
                        />
                        {weightsError ? (
                            <p className="text-xs text-red-500">{weightsError}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                The 19 parameters used by the FSRS algorithm. Only modify if you
                                know what you are doing.
                            </p>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}
