import type { Metadata, Viewport } from 'next'
import { Montserrat, Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { InventoryProvider } from '@/lib/inventory-context'
import { CartProvider } from '@/lib/cart-context'
import { AiChatbox } from '@/components/ai-chatbox'
import { Toaster } from 'sonner'
import './globals.css'

const _montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-montserrat',
  weight: ['700', '800'],
})

const _plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'BadmintonHub - Đặt Sân Cầu Lông Online',
  description: 'Hệ thống đặt sân cầu lông và cung cấp phụ kiện thể thao hàng đầu Việt Nam',
}

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${_montserrat.variable} ${_plusJakarta.variable} font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <InventoryProvider>
            <CartProvider>
              {children}
              <AiChatbox />
              <Toaster richColors position="top-right" />
            </CartProvider>
          </InventoryProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
