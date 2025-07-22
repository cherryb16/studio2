import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) {
    return '';
  }

  const words = nameOrEmail.split(' ');
  const initials = words
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  return initials;
}