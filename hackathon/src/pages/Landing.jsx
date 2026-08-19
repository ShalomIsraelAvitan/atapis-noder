import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useRef } from 'react'
import './Landing.css'

function Landing() {
  const { isAuthenticated } = useAuth()
  const statRefs = useRef([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.5 }
    )

    statRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => {
      statRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref)
      })
    }
  }, [])

  const animateCounter = (element) => {
    const targetValue = parseFloat(element.dataset.target)
    let current = 0
    const increment = targetValue / 60
    const timer = setInterval(() => {
      current += increment
      if (current >= targetValue) {
        element.textContent = targetValue === 1000 ? '1000+' : targetValue.toFixed(1)
        clearInterval(timer)
      } else {
        element.textContent = targetValue === 1000 ? Math.floor(current) + '+' : current.toFixed(1)
      }
    }, 30)
  }

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">About Us</div>
          <h1 className="hero-title">
            <span className="gradient-text">Smart Security System</span>
          </h1>
          <p className="hero-description">
            We are dedicated to providing cutting-edge security solutions
            through advanced AI-powered camera detection technology. Our mission is to
            protect what matters most with intelligent, real-time monitoring systems.
          </p>
          <div className="hero-buttons">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="btn btn-primary">
                  Get Started
                </Link>
                <Link to="/login" className="btn btn-secondary">
                  Sign In
                </Link>
              </>
            ) : (
              <Link to="/rooms" className="btn btn-primary">
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
        <div className="hero-visual">
          <div className="animated-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
          </div>
        </div>
      </div>

      <div className="about-section">
        <div className="about-content">
          <div className="about-text">
            <h2>Our Mission</h2>
            <p>
              At Smart Security System, we believe security should be intelligent, accessible, and reliable.
              Our AI-powered detection system provides 24/7 monitoring capabilities that help protect
              your property with precision and efficiency.
            </p>
          </div>
          <div className="about-stats">
            <div className="stat-item">
              <div 
                className="stat-number" 
                data-target="99.9"
                ref={(el) => (statRefs.current[0] = el)}
              >
                0
              </div>
              <div className="stat-label">Uptime %</div>
            </div>
            <div className="stat-item">
              <div 
                className="stat-number" 
                data-target="24"
                ref={(el) => (statRefs.current[1] = el)}
              >
                0
              </div>
              <div className="stat-label">Hour Monitoring</div>
            </div>
            <div className="stat-item">
              <div 
                className="stat-number" 
                data-target="1000"
                ref={(el) => (statRefs.current[2] = el)}
              >
                0
              </div>
              <div className="stat-label">Protected Sites</div>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <h2 className="features-title">What We Offer</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-accent"></div>
            <h3>Real-Time Detection</h3>
            <p>Advanced AI models for instant object recognition and tracking with millisecond response times</p>
          </div>
          <div className="feature-card">
            <div className="feature-accent"></div>
            <h3>Perimeter Security</h3>
            <p>24/7 area monitoring with instant intrusion detection alerts and comprehensive coverage</p>
          </div>
          <div className="feature-card">
            <div className="feature-accent"></div>
            <h3>Analytics Dashboard</h3>
            <p>Track detection events and monitor system performance in real-time with detailed insights</p>
          </div>
          <div className="feature-card">
            <div className="feature-accent"></div>
            <h3>Instant Alerts</h3>
            <p>Immediate notifications when objects are detected in monitored areas with customizable alert settings</p>
          </div>
        </div>
      </div>

      <div className="technology-section">
        <div className="tech-content">
          <h2>Technology</h2>
          <p>
            Built with state-of-the-art machine learning algorithms and computer vision technology,
            our system continuously learns and adapts to provide the most accurate detection results.
            We leverage cutting-edge AI to ensure your security is always one step ahead.
          </p>
        </div>
      </div>

      <div className="cta-section">
        <div className="cta-content">
          <h2>Ready to Secure Your Property?</h2>
          <p>Join our community of users who trust Smart Security System for their security needs</p>
          {!isAuthenticated ? (
            <Link to="/login" className="btn btn-primary btn-large">
              Get Started Today
            </Link>
          ) : (
            <Link to="/rooms" className="btn btn-primary btn-large">
              Access Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default Landing
