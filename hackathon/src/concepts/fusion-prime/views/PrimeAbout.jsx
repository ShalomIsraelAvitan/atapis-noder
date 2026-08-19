import { AboutHero, AboutSection, AboutPillars, AboutMvp, AboutVision } from '../../domain/AboutSections'
import { FusionArchitecture } from '../../domain/FusionArchitecture'

// Prime about: the premium narrative order from the decision doc —
// problem → innovation → architecture (parallel sensor paths) → capability
// pillars → honest MVP → vision. Large type, gold dividers, no marketing numbers.
export default function PrimeAbout({ vm }) {
  const { about } = vm
  return (
    <div className="pp-page pp-about">
      <AboutHero about={about} className="pp-about-hero" />
      <hr className="pp-divider" />
      <AboutSection section={about.problem} className="pp-about-section" />
      <AboutSection section={about.innovation} className="pp-about-section" />
      <hr className="pp-divider" />
      <AboutSection section={about.architecture} className="pp-about-section" />
      <FusionArchitecture showExample animateFlow className="pp-about-arch" />
      <AboutPillars pillars={about.pillars} className="pp-about-pillars" />
      <hr className="pp-divider" />
      <div className="pp-about-tail">
        <AboutMvp mvp={about.mvp} className="pp-card" />
        <AboutVision vision={about.vision} className="pp-card" />
      </div>
    </div>
  )
}
