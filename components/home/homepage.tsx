import { HeroSection } from "./hero-section";
import { Footer } from "./footer";
import Navbar from "./navbar";

export function Homepage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <Footer />
    </div>
  );
}
