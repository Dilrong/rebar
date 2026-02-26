import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'REBAR_ | Data Infrastructure'
export const size = {
    width: 1200,
    height: 630,
}

export const contentType = 'image/png'

// Image generation
export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 64,
                    background: '#0a0a0a',
                    color: '#f5f5f5',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: 80,
                    fontFamily: 'sans-serif',
                    border: '16px solid #f5f5f5',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#FF5A00',
                            color: '#ffffff',
                            fontSize: 32,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}
                    >
                        STATUS: ACTIVE
                    </div>
                    <h1
                        style={{
                            fontSize: 120,
                            fontWeight: 900,
                            margin: 0,
                            marginTop: 40,
                            lineHeight: 0.9,
                            letterSpacing: '-0.05em',
                        }}
                    >
                        REBAR_
                    </h1>
                    <p
                        style={{
                            fontSize: 40,
                            color: '#a3a3a3',
                            marginTop: 20,
                            fontFamily: 'monospace',
                        }}
                    >
                        DATA INFRASTRUCTURE
                    </p>
                </div>

                <div style={{ display: 'flex', width: '100%', borderTop: '4px solid #333', paddingTop: 40, justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 24, color: '#FF5A00' }}>
                    <span>PORT: 3000</span>
                    <span>SSOT // SYSTEM.READY</span>
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
