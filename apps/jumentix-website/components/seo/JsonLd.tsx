type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON text for crawlers/agents.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
