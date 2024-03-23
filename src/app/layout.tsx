export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <meta name="icon" content="/favicon.png" />
      <body>{children}</body>
    </html>
  )
}
