"use client";

import Card from "@/components/ui/Card";

// Placeholder scaffold — teammate is designing the real layout in Figma.
const USER_NAME = "User";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface">
          <img src="/mascot/avatar.png" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading truncate text-lg font-semibold text-ink">{USER_NAME}</h1>
          <p className="text-sm text-ink-muted">Profile</p>
        </div>
      </div>

      <Card className="p-4 text-center text-sm text-ink-muted">
        Profile page coming soon.
      </Card>
    </div>
  );
}
