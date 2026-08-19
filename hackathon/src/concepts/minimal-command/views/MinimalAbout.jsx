import { AboutHero, AboutSection, AboutPillars, AboutMvp, AboutVision } from '../../domain/AboutSections'
import { FusionArchitecture } from '../../domain/FusionArchitecture'

// Minimal interpretation: quiet vertical product story.
export default function MinimalAbout({ vm }) {
  const { about } = vm
  return (
    <div className="mn-page mn-about">
      <AboutHero about={about} className="mn-about-hero" />
      <AboutSection section={about.problem} />
      <AboutSection section={about.innovation} />
      <AboutPillars pillars={about.pillars} />
      <AboutSection section={about.architecture} />
      <FusionArchitecture className="mn-about-arch" />
      <AboutMvp mvp={about.mvp} />
      <AboutVision vision={about.vision} />
    </div>
  )
}
