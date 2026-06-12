import { EmailPort, OutgoingEmail } from '../ports/email.port';

/** Dev/test email adapter: records sends (and optionally logs). Resend/ACS replace this. */
export class ConsoleEmailAdapter implements EmailPort {
  readonly sent: OutgoingEmail[] = [];
  /** Set in tests to simulate provider outage. */
  failNext = false;

  constructor(private readonly log = false) {}

  send(email: OutgoingEmail): boolean {
    if (this.failNext) {
      this.failNext = false;
      return false;
    }
    this.sent.push(email);
    if (this.log) console.log(`[email] to=${email.to} subject=${email.subject}`);
    return true;
  }
}
