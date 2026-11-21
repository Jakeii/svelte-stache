---
'svelte-stache': patch
---

Fix staches using the wrong cache when a page has more than one `StacheProvider`. Factory `invalidate` now applies to every provider on the page, and does nothing (with a warning) during SSR
