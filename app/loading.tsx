"use client"

import { ShuttlecockLoader } from "@/components/shuttlecock-loader"

export default function RootLoading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F8FA] select-none">
      <ShuttlecockLoader size={72} textColor="text-slate-500 font-bold" />
    </div>
  )
}
