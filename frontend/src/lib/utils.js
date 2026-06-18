import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function titleCase(value = "") {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function decisionTone(decision) {
  return {
    AUTO_APPROVE: "success",
    HUMAN_REVIEW: "warning",
    AUTO_REJECT: "danger",
    approved: "success",
    rejected: "danger",
    pending: "warning",
  }[decision] || "neutral"
}

