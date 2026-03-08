import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Essay",
}

export default function EssayLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
