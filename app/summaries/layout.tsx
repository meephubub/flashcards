import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Email Summaries",
    description: "Daily email summaries",
}

export default function SummariesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
