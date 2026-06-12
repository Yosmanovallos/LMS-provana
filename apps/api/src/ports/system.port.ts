export interface ClockPort {
  now(): Date;
}

export interface IdPort {
  next(): string;
}
