import { AsyncLocalStorage } from "node:async_hooks";
import nodemailer from "nodemailer";
import { z } from "zod";
import { mailConfig } from "./config";
import { passwordResetEmail } from "./messages";
import type { Locale } from "../lib/contracts";

export class MailDeliveryError extends Error {
  constructor() { super("Password recovery delivery could not be confirmed."); this.name = "MailDeliveryError"; }
}

// Better Auth intentionally catches email callback failures. Preserve the outcome per
// request so the HTTP layer can report unavailability instead of claiming delivery.
const delivery = new AsyncLocalStorage<{ failed: boolean }>();
export function markMailDeliveryFailed() { const state = delivery.getStore(); if (state) state.failed = true; }
export async function observeMailDelivery<T>(operation: () => Promise<T>): Promise<{ result: T; failed: boolean }> {
  const state = { failed: false };
  const result = await delivery.run(state, operation);
  return { result, failed: state.failed };
}

export async function sendPasswordResetEmail(to: string, url: string, locale?: Locale): Promise<void> {
  const config = mailConfig();
  if (!config || !z.email().safeParse(to).success) throw new MailDeliveryError();
  const transport = nodemailer.createTransport(config.options);
  try {
    const result = await transport.sendMail({ from: config.from, to, ...passwordResetEmail(locale, url) });
    if (result.accepted.length !== 1 || result.rejected.length || result.accepted[0].toLowerCase() !== to.toLowerCase()) throw new MailDeliveryError();
  } catch {
    // Provider errors can contain recipient addresses, credentials or reset links.
    // Never expose/log the raw error and never retry an ambiguously accepted message.
    markMailDeliveryFailed();
    throw new MailDeliveryError();
  } finally { transport.close(); }
}

/** Explicit operator check: connects/authenticates, but does not send a message. */
export async function verifyMailConnection(): Promise<void> {
  const config = mailConfig();
  if (!config) throw new MailDeliveryError();
  const transport = nodemailer.createTransport(config.options);
  try { await transport.verify(); } catch { throw new MailDeliveryError(); }
  finally { transport.close(); }
}
