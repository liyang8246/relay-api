import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

// 错误类型判断
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("quota") || msg.includes("429");
  }
  return false;
}

export function isInsufficientQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("insufficient") || msg.includes("quota") || msg.includes("balance");
  }
  return false;
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout");
  }
  return false;
}

export function shouldFailover(error: unknown): boolean {
  return isRateLimitError(error) || isInsufficientQuotaError(error) || isTimeoutError(error);
}
