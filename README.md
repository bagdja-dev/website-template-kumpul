# `@bagdja/kumpul`

Sample package for the `kumpul` Bagdja website template. Its SSR renderer
implements the supplied Kumpul direction using Bagdja section, theme,
profile, page, location, FAQ, and catalog props. The original visual prototype is
preserved under [`design-reference/`](./design-reference/) as reference.

The design handoff guide, available section catalog, external renderer props,
runtime limits, and reusable design prompt are maintained separately in the
`website/templates/guide` repository.

See [`design-reference/README.md`](./design-reference/README.md) for the visual
direction and notes about the prototype's sample data and host-managed pages.

## Contract

- Package: `@bagdja/kumpul`
- Version: `1.0.0`
- Template slug: `kumpul`
- `rendererApiVersion`: `1`
- Entry point: `dist/server.cjs`
- Export: `render(props)`, returning a React element
- React: supplied by the Bagdja runtime

The package is kept separate from the production renderer. Publishing a package
does not publish or activate a template in the runtime registry; registration,
review, and publication are separate platform steps.

## Development

```sh
npm install
npm run dev
npm test
npm pack --dry-run
```

`npm run dev` opens a local SSR preview at `http://127.0.0.1:4173`. Choose a
fixture and desktop/mobile width from the toolbar. Changes in `src/` and
`fixtures/` refresh automatically. The `home`, `catalog`, `about`,
`how-it-works`, and `empty` fixtures are mock props only; no Bagdja API, tenant
data, or host actions are used. The about and how-it-works fixtures demonstrate
the existing `about`, `features_grid`, `gallery`, `service_process_section`,
and `faq_list` section contracts. The catalog fixture loads its local
search/category filter from `src/client.js`,
which filters and paginates cards already present in the fixture (12 per page).
The renderer does not fetch more catalog data, and local pagination does not
reduce the SSR response size because all supplied product cards are rendered
before the browser enhancement runs.
Gathering detail links lead to the host-managed product detail route; this
package does not invent an external gathering-detail or transaction contract.

Use this repository as a starting sample: create a new designer repository
from it, then replace the renderer and fixtures while preserving the package
and manifest contract. The local preview is a development aid, not a substitute
for Bagdja Studio/reviewer preview or the isolated production runtime.

The runtime's optional `client_bundle` capability is approval-gated. Review
and approve the exact package version before enabling its browser bundle in
Bagdja; the local fixture preview is not that approval.

`npm run build` builds the package; `npm test` checks the renderer, and
`npm pack --dry-run` previews the contents to be uploaded to npm without
publishing anything. The design reference is documentation material and is
intentionally excluded from the published package.
