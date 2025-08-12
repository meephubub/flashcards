import Navbar from "@/components/home/navbar";
import { Footer } from "@/components/home/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

export function Pricing() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <Navbar />
      {/* Spacer to offset fixed navbar height */}
      <div aria-hidden className="h-24 md:h-28 lg:h-32" />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-0">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-black">Learn faster with beautiful simplicity</h1>
          <p className="mt-3 text-base text-gray-600">Create, review, and master your knowledge. No clutter. Just focus.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild className="bg-black text-white hover:bg-gray-800">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button asChild variant="outline" className="border-black text-black hover:bg-black hover:text-white">
              <Link href="/home">Explore</Link>
            </Button>
          </div>
        </div>
        <div className="mt-10 h-px w-full bg-black/10" />
      </section>

      {/* Pricing Section */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        <div className="text-center mb-10 mt-10">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-black">Simple pricing</h2>
          <p className="mt-2 text-sm text-gray-600">Pick a plan that fits. Minimal, transparent, no surprises.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <Card className="border-black/10">
            <CardHeader>
              <CardTitle className="text-xl">Free</CardTitle>
              <CardDescription className="text-gray-600">Get started and try the basics.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-semibold">$0</span>
                <span className="text-gray-600"> / mo</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Up to 2 decks</li>
                <li>• 100 cards</li>
                <li>• Basic review</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                <Link href="/signup?plan=free">Get started</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro */}
          <Card className="border-black bg-black text-white">
            <CardHeader>
              <CardTitle className="text-xl text-white">Pro</CardTitle>
              <CardDescription className="text-gray-300">Everything you need to learn faster.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-semibold">$8</span>
                <span className="text-gray-300"> / mo</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li>• Unlimited decks</li>
                <li>• Unlimited cards</li>
                <li>• Smart scheduling</li>
                <li>• AI card generation</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full bg-white text-black hover:bg-gray-200">
                <Link href="/signup?plan=pro">Upgrade to Pro</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Enterprise */}
          <Card className="border-black/10">
            <CardHeader>
              <CardTitle className="text-xl">Enterprise</CardTitle>
              <CardDescription className="text-gray-600">For teams that need control.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-semibold">Custom</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Centralized billing</li>
                <li>• SSO and roles</li>
                <li>• Priority support</li>
                <li>• Dedicated onboarding</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                <Link href="/contact?topic=enterprise">Contact sales</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto mb-4">
          <h3 className="text-xl font-semibold text-black mb-4 text-center">Frequently asked questions</h3>
          <Accordion type="single" collapsible className="border-t border-black/10">
            <AccordionItem value="item-1" className="border-b border-black/10">
              <AccordionTrigger className="text-left">Can I try Pro before paying?</AccordionTrigger>
              <AccordionContent className="text-gray-700">We don't offer trials yet, but you can upgrade and cancel anytime within the month.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-b border-black/10">
              <AccordionTrigger className="text-left">Will my data be private?</AccordionTrigger>
              <AccordionContent className="text-gray-700">Yes. Your decks and cards are private to your account, protected with RLS on Supabase.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-b border-black/10">
              <AccordionTrigger className="text-left">Can I cancel anytime?</AccordionTrigger>
              <AccordionContent className="text-gray-700">Absolutely. Plans are month-to-month with no long-term commitments.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>

      <Footer />
    </div>
  );
}