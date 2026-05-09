import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Exam",
}

export default function ExamLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
