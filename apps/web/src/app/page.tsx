export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-8 py-24">
      <p className="text-sm font-medium text-teal-700">DEVELOPMENT · STAGE 1</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Rental Fleet Operating System</h1>
      <p className="mt-6 text-lg">Nền tảng dự án đã sẵn sàng cho bước phát triển tiếp theo.</p>
      <ul className="mt-8 list-disc space-y-3 pl-5">
        <li>Web: Next.js · TypeScript · Tailwind CSS</li>
        <li>API: NestJS · TypeScript · localhost:3001</li>
        <li>Infrastructure: Supabase development · Singapore</li>
      </ul>
      <p className="mt-10 text-sm text-gray-500">Auth và các module nghiệp vụ sẽ được triển khai ở giai đoạn tiếp theo.</p>
    </main>
  );
}
