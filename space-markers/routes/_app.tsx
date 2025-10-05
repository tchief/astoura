import { type PageProps } from "$fresh/server.ts";
export default function App({ Component }: PageProps) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Space Markers - Космічна гра</title>
        <link rel="stylesheet" href="/styles.css" />
        <script src="https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js" charset="utf-8"></script>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
}
