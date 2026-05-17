type Props = {
  title: string;
  description?: string;
};

export function SectionHeader({ title, description }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
