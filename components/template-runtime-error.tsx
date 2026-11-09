interface TemplateRuntimeErrorViewProps {
  code: string;
  message: string;
}

export function TemplateRuntimeErrorView({ code, message }: TemplateRuntimeErrorViewProps) {
  return (
    <main role="alert" className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Template runtime</p>
      <h1 className="mt-2 text-2xl font-semibold">Template tidak dapat dirender</h1>
      <p className="mt-3 text-sm text-gray-700">{message}</p>
      <code className="mt-4 block rounded bg-gray-100 px-3 py-2 text-xs text-gray-600">{code}</code>
      <p className="mt-4 text-xs text-gray-500">Template runtime gagal tertutup; renderer built-in tidak dipakai sebagai fallback.</p>
    </main>
  );
}
