import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Statistics",
}

export default function StatsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
