import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return ''

  const parts = nameOrEmail.split('@')[0].split(' ')
  let initials = ''

  for (const part of parts) {
    if (part.length > 0) {
      initials += part[0]
    }
  }

  return initials.toUpperCase()
}
