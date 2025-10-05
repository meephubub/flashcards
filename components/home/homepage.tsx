import { HeroSection } from "./hero-section";
import { BentoFeatures } from "./bento-features";
import { ModernStudyModes } from "./modern-study-modes";
import { InteractiveShowcase } from "./interactive-showcase";
import { CTASection } from "./cta-section";
import { Footer } from "./footer";
import Navbar from "./navbar";
import { Sections } from "./sections";

export function Homepage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <BentoFeatures />
      <ModernStudyModes />
      <Sections />
      <InteractiveShowcase />
      <CTASection />
      <Footer />
    </div>
  );
}
