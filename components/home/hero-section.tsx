import Beams from '../Beams';
import TextPressure from '../TextPressure';

export function HeroSection() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '120vh' }}>
      {/* Background beams */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={12}
          lightColor="#fff"
          speed={5}
          scale={0.2}
          rotation={40}
        />
      </div>

      {/* Overlay content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '90%',
            padding: '0px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          {/* Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(6px)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: '#fff',
                color: '#0b1115',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.3px'
              }}
            >
              New
            </span>
            <span style={{ fontSize: '14px', opacity: 0.95 }}>AI-powered flashcards</span>
          </div>

          {/* Title (non-interactive) — moved here */}
          <div style={{ width: '100%', pointerEvents: 'none' }}>
            <TextPressure
              text="Yasashi"
              flex={false}
              alpha={true}
              minAlpha={0.3}
              stroke={false}
              width={false}
              weight={false}
              italic={false}
              textColor="#ffffff"
              strokeColor="#000000"
              minFontSize={30}
            />
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <a
              href="/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                borderRadius: '10px',
                background: '#fff',
                color: '#0b1115',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 10px 20px rgba(255, 255, 255, 0.25)'
              }}
            >
              Get started
            </a>
            <a
              href="#learn-more"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              Learn more
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
