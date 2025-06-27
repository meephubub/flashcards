import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Brain, Github, Twitter, Linkedin, Mail } from "lucide-react";

const footerSections = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "#features" },
      { name: "Study Modes", href: "#study-modes" },
      { name: "AI Assistant", href: "#ai" },
      { name: "Notes System", href: "#notes" },
      { name: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Documentation", href: "#docs" },
      { name: "API Reference", href: "#api" },
      { name: "Tutorials", href: "#tutorials" },
      { name: "Blog", href: "#blog" },
      { name: "Help Center", href: "#help" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About Us", href: "#about" },
      { name: "Careers", href: "#careers" },
      { name: "Contact", href: "#contact" },
      { name: "Privacy Policy", href: "#privacy" },
      { name: "Terms of Service", href: "#terms" },
    ],
  },
];

const socialLinks = [
  { name: "GitHub", icon: Github, href: "#" },
  { name: "Twitter", icon: Twitter, href: "#" },
  { name: "LinkedIn", icon: Linkedin, href: "#" },
  { name: "Email", icon: Mail, href: "#" },
];

export function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            {/* Brand Section */}
            <div className="lg:col-span-4">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                  <Brain className="h-5 w-5 text-black" />
                </div>
                <span className="text-xl font-bold">Flashcards</span>
              </div>
              <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-md">
                Transform your learning with AI-powered flashcards, intelligent
                study modes, and advanced note-taking. Perfect for students,
                professionals, and lifelong learners.
              </p>

              {/* Newsletter Signup */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                  Stay Updated
                </h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                  />
                  <Button
                    variant="secondary"
                    className="bg-white text-black hover:bg-gray-200"
                  >
                    Subscribe
                  </Button>
                </div>
              </div>
            </div>

            {/* Links Sections */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                {footerSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-6">
                      {section.title}
                    </h3>
                    <ul className="space-y-4">
                      {section.links.map((link) => (
                        <li key={link.name}>
                          <a
                            href={link.href}
                            className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                          >
                            {link.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-gray-800" />

        {/* Bottom Footer */}
        <div className="py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <p className="text-sm text-gray-400">
                © 2024 Flashcards. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a
                  href="#privacy"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Privacy
                </a>
                <a
                  href="#terms"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Terms
                </a>
                <a
                  href="#cookies"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cookies
                </a>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors duration-200"
                  aria-label={social.name}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
