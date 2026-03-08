import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Maths",
}

export default function MathsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
