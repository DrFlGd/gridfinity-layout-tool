# Gridfinity Layout Tool: offline builds

This fork builds [andymai/gridfinity-layout-tool](https://github.com/andymai/gridfinity-layout-tool) releases as offline web bundles for [Generator Library](https://github.com/DrFlGd/Generator-Library). Nothing of the app's source lives here; every build comes straight from an upstream release tag.

- `.github/workflows/library-bundles.yml` runs daily (or by hand with a tag). It builds the newest upstream release with `VITE_SELF_HOSTED=1` and publishes it as an `upstream-<version>` release with one `gridfinity-layout-tool-web-<version>.zip`. The newest 15 builds are kept.
- `scripts/vendor-unicode-fonts.mjs` copies the fonts the 3D labels use into the build, so the bin designer loads without an internet connection.
- `generator.json` tells Generator Library how to list and install it.

In the offline copy, the layout planner, bin designer, baseplate generator and STL/STEP/3MF export work as on the website. Sign-in, sharing, sync and community designs need the online site.

The earlier Tauri desktop build is kept on the `archive/desktop-tauri` branch and its `desktop-v*` releases.

## License

AGPL-3.0, as upstream. Each release links to the exact upstream source it was built from.
