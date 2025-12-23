import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RepoPulse - Open Source Project Health Dashboard',
  description: 'Analyze and monitor the health of open source projects',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === 'production' && (
          <script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id="f496fea8-5956-4d1e-ae3d-89d5d4fa538f"
          ></script>
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
