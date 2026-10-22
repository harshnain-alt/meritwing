import type { PreviewLine, ResumePreviewModel } from "@/lib/resumePreview";

export function ResumePreview({ model }: { model: ResumePreviewModel }) {
  return (
    <article
      aria-label="Resume layout preview"
      className="mx-auto w-full max-w-[42rem] rounded-sm bg-white px-6 py-8 text-[13px] leading-snug text-[#1b1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-line sm:px-12 sm:py-11"
    >
      <header className="text-center">
        <h3 className="text-[22px] font-semibold tracking-tight">{model.name}</h3>
        {model.contact.length > 0 && (
          <p className="mt-1 text-[12.5px] text-[#4a4d52]">{model.contact.join("  ·  ")}</p>
        )}
      </header>

      {model.sections.map((section) => (
        <section key={section.heading} className="mt-5">
          <h4 className="border-b border-[#1b1c1e]/70 pb-0.5 text-[11.5px] font-bold uppercase tracking-[0.08em]">
            {section.heading}
          </h4>
          <div className="mt-2 space-y-3">
            {section.entries.map((entry) => (
              <div key={entry.title}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold">{entry.title}</p>
                  {entry.dates && <p className="text-[12.5px] tabular-nums">{entry.dates}</p>}
                </div>
                {entry.subtitle && <p className="italic text-[#3a3d42]">{entry.subtitle}</p>}
                {entry.context && <p className="mt-0.5 text-[#3a3d42]">{entry.context}</p>}
                {entry.bullets.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {entry.bullets.map((b, i) => (
                      <Bullet key={i}>{b}</Bullet>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {section.lines.length > 0 && <Lines lines={section.lines} />}
          </div>
        </section>
      ))}
    </article>
  );
}

function Lines({ lines }: { lines: PreviewLine[] }) {
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) =>
        line.bullet ? (
          <ul key={i}>
            <Bullet>{line.text}</Bullet>
          </ul>
        ) : (
          <p key={i} className={i > 0 && !lines[i - 1].bullet ? "" : i > 0 ? "pt-1.5" : ""}>
            {line.text}
          </p>
        ),
      )}
    </div>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true">•</span>
      <span>{children}</span>
    </li>
  );
}
