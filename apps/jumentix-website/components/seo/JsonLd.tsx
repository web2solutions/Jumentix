interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const JsonLd = ({ data }: JsonLdProps) => (
  <script
    // JSON-LD must be raw JSON text for crawlers/agents.
    // eslint-disable-next-line react/no-danger -- JSON.stringify output is data, not markup; script type is application/ld+json
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    type="application/ld+json"
  />
);
