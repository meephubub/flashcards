
interface HeatmapDay {
    date: string
    count: number
}

function HeatmapBlock({ date, count }: { date: string, count: number }) {
    // 5 intensity levels
    // 0 = bg-neutral-100 dark:bg-neutral-800
    // 1 = bg-emerald-200 dark:bg-emerald-900
    // 4 = bg-emerald-600 dark:bg-emerald-500

    let colorClass = "bg-neutral-100/50 dark:bg-neutral-800/50 hover:bg-neutral-200 dark:hover:bg-neutral-700"
    if (count > 0) colorClass = "bg-emerald-200 dark:bg-emerald-900/40 hover:bg-emerald-300"
    if (count > 15) colorClass = "bg-emerald-300 dark:bg-emerald-800/60 hover:bg-emerald-400"
    if (count > 30) colorClass = "bg-emerald-400 dark:bg-emerald-700/80 hover:bg-emerald-500"
    if (count > 60) colorClass = "bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-600"

    return (
        <div
            title={`${date}: ${count} activity points`}
            className={`w-3 h-3 rounded-[2px] transition-colors cursor-pointer ${colorClass}`}
        />
    )
}

export function ActivityHeatmap({ data }: { data: HeatmapDay[] }) {
    // Generate last 365 days grid
    // Grid: 7 rows (days), ~52 cols (weeks)
    // We iterate cols then rows

    const today = new Date()
    const endDate = new Date(today)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364) // approx year

    // Normalize logic slightly tricky for React component without heavier deps?
    // Let's do simple: last 20 weeks? Or full year CSS grid?

    // Map data to quick lookup
    const map = new Map<string, number>()
    data.forEach(d => map.set(d.date, d.count))

    // Create weeks array
    const weeks: { days: { date: string, count: number }[] }[] = []

    let current = new Date(startDate)
    // Align to Sunday start?
    const startDay = current.getDay()
    current.setDate(current.getDate() - startDay) // Back to Sunday

    while (current <= endDate) {
        const weekDays = []
        for (let i = 0; i < 7; i++) {
            const dateStr = current.toISOString().split('T')[0]
            weekDays.push({
                date: dateStr,
                count: map.get(dateStr) || 0
            })
            current.setDate(current.getDate() + 1)
        }
        weeks.push({ days: weekDays })
    }

    // Trim weeks that are entirely in future (unlikely given loop condition)

    return (
        <div className="flex flex-col gap-2 overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-max">
                {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                        {week.days.map((day, dIdx) => (
                            <HeatmapBlock key={day.date} date={day.date} count={day.count} />
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-xs text-neutral-400 dark:text-neutral-500 pl-1 pr-4">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 bg-neutral-100 dark:bg-neutral-800 rounded-[2px]" />
                    <div className="w-3 h-3 bg-emerald-200 dark:bg-emerald-900/40 rounded-[2px]" />
                    <div className="w-3 h-3 bg-emerald-400 dark:bg-emerald-700/80 rounded-[2px]" />
                    <div className="w-3 h-3 bg-emerald-500 dark:bg-emerald-600 rounded-[2px]" />
                </div>
                <span>More</span>
            </div>
        </div>
    )
}
