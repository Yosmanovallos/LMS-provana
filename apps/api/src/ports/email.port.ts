export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
}

export interface EmailPort {
  /** Returns false on delivery failure — consumers record, never throw. */
  send(email: OutgoingEmail): boolean;
}
