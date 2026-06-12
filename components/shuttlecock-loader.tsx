"use client"

import { cn } from "@/lib/utils"

interface ShuttlecockLoaderProps {
  className?: string
  size?: number
  showText?: boolean
  textColor?: string
}

export function ShuttlecockLoader({ 
  className, 
  size = 60, 
  showText = true,
  textColor = "text-muted-foreground"
}: ShuttlecockLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3.5", className)}>
      <div 
        className="relative animate-spin" 
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-primary fill-none stroke-current"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Cork Base (Half-sphere facing down) */}
          <path 
            d="M 35 65 A 15 15 0 0 0 65 65 Z" 
            className="fill-[#FF6B35]/15 stroke-[#FF6B35]"
          />
          {/* Red Stripe Band on Cork */}
          <path 
            d="M 34.5 65 L 65.5 65" 
            stroke="#ef4444" 
            strokeWidth="4.5"
          />
          {/* Feather Shafts / Ribs */}
          <path d="M 35 65 L 20 20" />
          <path d="M 42 65 L 35 20" />
          <path d="M 50 65 L 50 20" />
          <path d="M 58 65 L 65 20" />
          <path d="M 65 65 L 80 20" />
          
          {/* Connecting Webbing/Stitch Rows */}
          <path d="M 23.5 35 L 76.5 35" strokeDasharray="3 3" />
          <path d="M 20 20 L 80 20" />

          {/* Individual feather vanes detailing */}
          <path d="M 20 20 Q 25 32 30 45" strokeWidth="2.5" />
          <path d="M 35 20 Q 38 32 40 45" strokeWidth="2.5" />
          <path d="M 50 20 Q 50 32 50 45" strokeWidth="2.5" />
          <path d="M 65 20 Q 62 32 60 45" strokeWidth="2.5" />
          <path d="M 80 20 Q 75 32 70 45" strokeWidth="2.5" />
        </svg>
      </div>
      {showText && (
        <span className={cn("text-xs font-bold tracking-wider uppercase animate-pulse", textColor)}>
          Đang tải dữ liệu...
        </span>
      )}
    </div>
  )
}
