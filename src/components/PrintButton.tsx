"use client";

export function PrintButton() {
  return <button className="btn primary" onClick={() => window.print()}>印刷する</button>;
}
