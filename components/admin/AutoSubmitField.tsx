'use client';

export default function AutoSubmitField({ children }: { children: React.ReactNode }) {
  return (
    <div
      onChange={(e) => (e.target as HTMLElement).closest('form')?.requestSubmit()}
      style={{ display: 'contents' }}
    >
      {children}
    </div>
  );
}
