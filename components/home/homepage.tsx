import { HeroSection } from "./hero-section";
import { BentoFeatures } from "./bento-features";
import { ModernStudyModes } from "./modern-study-modes";
import { InteractiveShowcase } from "./interactive-showcase";
import { CTASection } from "./cta-section";
import { Footer } from "./footer";
import Navbar from "./navbar";

export function Homepage() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <BentoFeatures />
      <ModernStudyModes />
      <InteractiveShowcase />
      <CTASection />
      <Navbar />
      <Footer />
    </div>
  );
}
