# FCC Crystallography Explorer: requirements analysis and final design

## My decision

I built one mathematically tested crystallography engine and one interactive interface. I deliver them as two self-contained editions: an offline HTML app, and a Colab/Jupyter notebook that embeds the identical app. I use JavaScript with Three.js for the interactive 3D views, SVG for an independently derived 2D surface net, and Python for the notebook packaging and an optional local launcher.

My main goal is understanding. A learner should be able to ask a question, set up an unambiguous geometric object, see it, inspect its coordinates and check the derivation. The app is a teaching lab for the ideal FCC crystal. It is not a general materials simulator.

## 1. What I improved in the original specification

| Issue or ambiguity | How I resolved it |
|---|---|
| "Four physical atoms" can suggest an isolated finite cluster | I say **four atoms per conventional cell under periodic sharing**. A finite cluster counts its actual sites instead. |
| An earlier counting mode removed boundary spheres people expect to see | I separate computational atoms from visible sites. The default is a closed 14-site drawing, with separate unique and ghost modes. |
| Fractional spheres can look hollow after simple clipping | I generate capped mesh sections for boundary atoms and check the half, quarter and eighth volumes numerically. |
| A generic "fractional coordinate" has no named basis | I keep conventional fractions, supercell fractions, Cartesian Å, primitive coefficients and the stacking frame apart, and I name each one. |
| Arbitrary supercells can quietly change definitions | I keep the infinite FCC lattice model independent of the finite display box. Each box dimension stays within 1–10 so interaction stays predictable. |
| An element name may suggest measured material properties | The element is only a label. The default 4.05 Å is an editable, illustrative FCC value. The radius is a hard-sphere construction, not a database value. |
| `[uvw]` gives an orientation, not a physical length | I give each arrow an explicit multiplier and origin. I test the actual scaled vector as well as `a/2[uvw]`. |
| Reducing Miller indices can erase the diffraction order | I keep the raw indices. Orientation may be shared, but `d100` and `d200` stay distinct. |
| "Plane family" means different sets in different contexts | I separate the cubic symmetry family `{hkl}`, parallel integer-c planes, occupied atomic layers and one located plane. |
| A negative canonical plane may miss the positive box | I show the correct intersection or a clear message. I offer centered, translated and extended versions, and I never move the plane silently. |
| Geometric spacing, occupied-layer gap and normal repeat often get mixed up | I compute and label all three separately. Reflection parity is a separate question with its own display. |
| A shortest-vector search may return a nonprimitive surface cell | I build the exact integer nullspace in the FCC primitive basis, then apply unimodular Gauss reduction. I check `surface area × layer gap = primitive volume`. |
| A "conventional surface cell" is not unique for every orientation | I offer a clearly named integer cubic-translation comparison mesh. I don't call it a universal conventional surface cell. |
| A top-view slab projection can pass for a surface net | I derive one occupied atomic layer analytically and project it onto orthogonal in-plane axes. |
| High-index surfaces can be very anisotropic | I keep their real geometry, lengths and cell area. Zoom/pan and a finite patch control make them easy to inspect. |
| ABC letters can be mistaken for chemical species or arbitrary colors | I state the lateral shifts and the coordinate frame. I verify that the FCC stack transforms back to the actual cubic FCC lattice. |
| AAA at the FCC layer spacing makes spheres overlap | I label AAA as a non-close-packed simple-hexagonal comparison and use an a/√2 height, so the spheres touch without overlapping. |
| Visual layer separation could suggest a changed crystal | I report both the ideal gap and the displayed gap, with an explicit exaggeration multiplier. |
| Neighbors in a finite drawing get cut off at the boundaries | I enumerate infinite bulk FCC translations around the selected host, including images outside the box. |
| Surface coordination has several meanings | I report the shortest-neighbor count **within one layer** separately from bulk 12-fold coordination. I don't claim the coordination of a relaxed, terminated surface. |
| "Any important FCC concept" is not a finite acceptance criterion | I use concrete invariants and representative learning tasks, with an explicit line where advanced features begin. |
| Exports could pick up ghosts, holes, HCP comparisons or reciprocal points | XYZ/CIF/POSCAR always export the configured ideal **bulk FCC** supercell with unique periodic atoms. The export labels say so. |
| Two separate implementations would drift apart | Both editions carry the same bundled HTML and core. The notebook checks a SHA-256 hash to confirm they are identical. |

The additions I found most useful: a misconception panel, linked concept search, the numerical derivation next to each picture, a 12-step tour, explicit periodic wrapping, direct distances between two selections, reproducible view files and an independent Verify panel. All of them are in the app.

## 2. Prioritized requirements

### Must have

1. Correct monatomic FCC model, conventional and primitive bases, counts, boundaries and coordinate conventions.
2. Independent 1–10 supercell dimensions; unique, closed and ghost drawings; capped boundary spheres; outer/all/no cell boundaries; one selected conventional-cell box.
3. Pickable instanced atoms, educational/manual/hard-sphere radii, adjustable opacity and color, coordinate/site labels, selection highlighting.
4. Orthographic and perspective cameras; pan, rotate, zoom, fit; standard and custom look directions; plane-normal alignment.
5. Arbitrary signed nonzero integer indices within ±24; direction scale and origin; direction families; canonical/centered/origin/translated/occupied planes; symmetry and parallel sets; primary and comparison overlays.
6. Zone law, angles, translation validity, nearest-neighbor distance, packing fraction, volume, three distinct spacings and the diffraction selection rule.
7. Exact arbitrary-orientation surface basis; lengths, angle, area and density; analytic 2D net; primitive vectors/cell/tiling; bonds and selection.
8. ABC, ABAB and AAA comparisons; registry filters/colors, side/normal views, layer-addition animation, visible sequence and an explanation of spacing exaggeration.
9. Periodic neighbor shells, cutoff, bonds, octahedral/tetrahedral holes and the host environment of a selected hole.
10. Twelve slip systems, perfect Burgers vectors and their geometric meaning.
11. Contextual Learn, Calculate, Verify and Layers tabs; concept search; linked presets; guided tour; live legend.
12. Offline local edition, self-contained notebook edition, launch instructions, source, license, automated tests, state round-trip and correctly scoped exports.

### Should have (all included)

- Wigner–Seitz primitive cell and first-neighbor coordination hull.
- Primitive-cell isolation and tiling, coloring of bulk (111) registries.
- Second plane/direction comparisons; family animation.
- Schmid factors for all twelve systems, with selection straight from the table.
- Reciprocal BCC construction, primitive reciprocal basis, selected G, forbidden comparison markers, Bragg-position table.
- PNG and SVG output, Markdown calculation reports, CIF and POSCAR in addition to XYZ.

### Advanced / optional

I include these as **ideal geometry** only: Shockley partial-vector addition; stated intrinsic/extrinsic fault sequences; the coherent twin sequence and its marker plane.

I deferred: relaxed defect structures, dislocation lines/cores and elastic fields, fault energies and partial separation, finite-temperature phonons, reconstruction/adsorption, full X-ray intensities or dynamical diffraction, pole figures/orientation distributions/EBSD, imported arbitrary crystals, noncubic lattices, a general multi-plane scene editor, multiple selected cell boxes, measured material-property databases, GIF/video encoding and export of defect/HCP structures. Each of these needs extra physical models or a separate workflow, and I don't want to stand in for them with misleading approximations.

## 3. Information architecture and interaction rules

I organize the controls into seven task groups: Crystal & unit cells; Directions & planes; Surface crystallography; Atomic stacking; Local environment; Slip & Burgers vectors; Reciprocal & diffraction.

The center holds four workspaces: the 3D crystal, the analytic 2D surface net, the 3D stacking comparison and 3D reciprocal space. A compact statistics strip and a selection inspector sit under the view. The right-hand panel switches between explanation, calculations, invariant checks and layer switches. On narrow screens that panel moves below the viewer.

My interaction rules:

- Ordinary changes keep unrelated state.
- Teaching presets set up a clear scene but keep the chosen lattice constant, element label and colors.
- Every drawing group can be turned off.
- Range controls update live without replacing the slider while it is being dragged.
- Invalid input shows a message and keeps the last valid scene.
- Colors back up labels and numbers. They are never the only way to identify something.

Every main explanation has a question, the idea in plain language, an equation, how to read the drawing, a common misconception, the current numerical values, a suggested experiment, related concepts and links to primary sources. I name the stacking and reciprocal coordinates explicitly. I keep the labels "3D primitive cell" and "2D primitive surface cell" distinct.

The 12-lesson tour runs from conventional counting through primitive geometry, directions/planes, surfaces, stacking, neighbors, holes, slip and reciprocal space. It never asks the learner to understand a term before showing how it is built.

## 4. Technical architecture and stack comparison

I compared these options for this specific two-edition teaching app. This is my design judgment for this project, not a claim that one framework is better in general.

| Candidate | Fit to this project | Tradeoff |
|---|---|---|
| Python + PyVista/VTK | Strong native scientific meshes, picking and geometry | Heavier native installation; notebook and local rendering need deliberate integration |
| Python + Panel + VTK | Good Python-driven controls and browser VTK panes | Adds Python/server/widget coordination for a task that can run entirely in a browser |
| Dash + Plotly | Useful dashboards and numerical charts | Detailed sphere meshes, capped boundary geometry and crystal-specific picking need more custom work than a normal chart |
| Three.js + Python backend | Strong custom 3D and room for future scientific services | A backend brings deployment and session synchronization with no benefit for this deterministic geometry |
| **Three.js + SVG; optional Python packaging** | Direct mesh control, instance picking, cameras, local files and an identical notebook view | The custom crystallography math must be modular and validated; 3D needs WebGL2 |

What I chose: Three.js 0.180.0 (pinned), esbuild 0.25.10 for the single-file bundle, dependency-free crystallography code in plain JavaScript, and standard Python scripts for packaging and the launcher. Playwright 1.51.1 and Prettier 3.6.2 are development tools only.

The app uses no paid API, login, runtime CDN, backend, telemetry, external font, remote image or proprietary visualization library. Google Colab is an optional hosted notebook service, not an open-source part of the app. Local HTML and local Jupyter both work without it.

How I split the source:

| Module | Responsibility |
|---|---|
| `src/crystal/math.js` | Vector operations, signed integer GCD/Bézout operations, validation and symmetry |
| `lattice.js`, `planes.js`, `surfaces.js` | Bulk FCC, plane intersection/layers and exact surface derivation |
| `environment.js`, `slip.js`, `stacking.js`, `reciprocal.js` | Teaching constructions with no renderer dependency |
| `verify.js` | Live scientific invariants |
| `src/visualization/geometry.js` | Polygon and capped-sphere mesh construction |
| `viewer.js`, `surface-view.js` | Three.js 3D and analytic SVG 2D adapters |
| `src/education/concepts.js` | My explanations, misconceptions, lessons, presets and references |
| `src/state.js`, `src/exports.js`, `src/app.js` | Validated settings, scoped exports and interface orchestration |
| `build.mjs`, `make_notebook.py`, `serve.py` | Reproducible packaging and launch |
| `tests/` | Unit tests of the crystallography engine and a browser smoke test |

## 5. Crystallographic mathematical model

I use conventional dimensionless coordinates X = r/a. The lattice is

`L/a = { (i,j,k)/2 : i,j,k integers and i+j+k even }`.

The conventional basis is `(0,0,0), (0,1/2,1/2), (1/2,0,1/2), (1/2,1/2,0)`. A half-open supercell has `4 Nx Ny Nz` sites. In the closed drawing, each boundary site gets the weight `2^(−b)`, where b is the number of outer boundary planes through the site. For one cell, `8/8 + 6/2 = 4`, with fourteen visible centers. These weights describe periodic sharing, not the atom count of a finite cluster.

The primitive translations are `p1=(a/2)[011], p2=(a/2)[101], p3=(a/2)[110]`, with volume `a³/4`, length `a/√2` and a pairwise angle of 60°. The touching-sphere radius is `a√2/4`, the nearest distance is `a/√2`, and the packing fraction is `π/(3√2)`.

A direction has a unit orientation and a separately scaled vector. I reduce the direction indices by their GCD to q. The shortest FCC translation is then `(a/2)q` when the sum of q is even, and `a q` otherwise. The linear density along an occupied row is the inverse of this shortest repeat. An arbitrary parallel row need not be occupied.

I write a located plane as `hX+kY+lZ=c`. For nonzero h, k, l its intercepts are `ac/h`, `ac/k`, `ac/l`. A zero coefficient means no unique finite intercept on that axis. The normal orientation is `[hkl]`. The cubic zone law is `hu+kv+lw=0`. Vector angles keep their direction (0–180°); plane angles use the acute, unoriented convention.

Let `g=gcd(k+l,h+l,h+k)`. Occupied planes sit at levels `c=jg/2`. So I get three different distances:

- Geometric `d_hkl=a/√(h²+k²+l²)`.
- Adjacent occupied-layer gap `Δ=a g/[2√(h²+k²+l²)]`.
- Pure normal lattice repeat: the shortest FCC translation parallel to `[hkl]`.

For (111) these are `a/√3`, `a/√3` and `√3a`. For (001) they are `a`, `a/2` and `a`. Scaling the indices changes geometric d but leaves the physical layer gap and the normal repeat unchanged.

For a surface translation `t=m1 p1 + m2 p2 + m3 p3`, the in-plane condition is the integer equation

`(k+l)m1 + (h+l)m2 + (h+k)m3 = 0`.

I get an exact primitive integer-kernel basis from Bézout identities. Two-dimensional Gauss reduction changes the basis only through integer unimodular operations, so the lattice is preserved. I map the two resulting integer vectors into cubic coordinates. Their cross-product magnitude is the primitive area. There is one lattice point per primitive surface cell, so the density is the inverse of the area. The independent check `A × Δ = a³/4` rules out a nonprimitive cell with a multiple of the area. To get the actual selected layer, I find a Bézout particular solution at `c=jg/2` and add the two translation generators. I project with `e1=t1/|t1|`, `e3=n/|n|`, `e2=e3×e1`.

Neighbor translations give shells of 12 at `a/√2`, 6 at `a` and 24 at `a√(3/2)`. Octahedral holes have six hosts and four sites per periodic cell. Tetrahedral holes have four hosts and eight sites. The maximum touching-sphere ratios are `√2−1` and `√(3/2)−1`.

The stacking frame is `e1=[1 −1 0]/√2`, `e2=[1 1 −2]/√6`, `e3=[111]/√3`. A triangular layer has side `a/√2`. The hollow shift I chose is `−(t1+t2)/3`. ABC at height `a/√3` maps back to the declared cubic FCC lattice. ABAB is the ideal HCP comparison. AAA uses height `a/√2`. The fault and twin sequences are explicit constructions, not relaxations.

Slip uses four unoriented {111} normals times three unoriented in-plane ⟨110⟩ directions. The Burgers magnitude is `a/√2`. The Schmid factor is `|l̂·n̂||l̂·b̂| ≤ 0.5`. My partial example is `a/2[1 −1 0] = a/6[2 −1 −1] + a/6[1 −2 1]`. Each partial has magnitude `a/√6` and lies in (111).

Reciprocal vectors obey `pi·bj=2πδij`. In conventional reciprocal units of `2π/a`, allowed nodes have all-even or all-odd h, k, l, and they form a BCC lattice. The reciprocal conventional edge is `4π/a`. The monatomic structure factor ratio is `1+(−1)^(k+l)+(−1)^(h+l)+(−1)^(h+k)`. The magnitude is `|G|=2π/d`. First-order Bragg geometry gives `2θ=2 asin(λ/(2d))`, but only if `λ≤2d`. A forbidden index has no ideal peak even when this geometric angle exists.

## 6. Validation and acceptance

My tests check identities and consequences I can measure independently, not just screenshots or a second copy of the same code. They cover all counts, surface primitivity for 2,196 signed index triples, unreduced-index behavior, signed plane intersections, translation minimality, neighbor/void environments, slip geometry, stacking nonoverlap, the inverse FCC-frame mapping, reciprocal duality, mesh volumes and structural export counts.

My browser checks cover the actual controls, raycast selection, all teaching presets, rejection of invalid input, 10³-cell limits, slider updates, empty scenes in all workspaces, saved camera round-trips, downloaded PNG/SVG/XYZ, search, the guided lessons and the exact Python-generated notebook iframe.

Inside the app, the Verify panel reruns the key invariants live for the current settings, so anyone can check them without the test suite.

The tasks I use to accept the app:

- Explain why fourteen visible sites count as four atoms.
- Tell d111 apart from the three-layer repeat.
- Derive all three low-index surface cells from one algorithm.
- Select a corner and recover twelve neighbors.
- Compare ABC and ABAB.
- Identify an octahedral hole.
- Select a slip system and check the zone law.
- Explain why (100) is an allowed surface orientation but a forbidden monatomic FCC reflection.

## 7. How I built it

1. I fixed the conventions, expected invariants, priorities and model boundaries first.
2. I wrote the pure geometry modules and the exact surface derivation, and tested them before connecting any rendering.
3. I added instanced 3D atoms, capped geometry, picking, cameras and a separate SVG surface adapter.
4. I connected state, overlays, contextual explanations, calculators and the tour.
5. I added the stacking, environment, slip and reciprocal modules and checked their physical meaning.
6. I packaged the same app locally and in a notebook, then added exports and round-trip validation.
7. I ran the math and browser checks, inspected screenshots, documented the limits and shipped the built files.

## 8. References

The explanations in the app are my own writing. These links support the definitions or offer further study. The app does not bundle them and does not need them to work offline.

- [IUCr: Miller indices](https://dictionary.iucr.org/Miller_indices)
- [IUCr: reciprocal lattice teaching pamphlet](https://www.iucr.org/what-we-do/education/pamphlets/reciprocal-lattice)
- [IUCr: structure factor](https://dictionary.iucr.org/Structure_factor)
- [Kiel University: partial dislocations and stacking faults](https://www.tf.uni-kiel.de/matwis/amat/def_en/kap_5/backbone/r5_4_1.html)
- [Kiel University: Burgers-vector teaching material](https://www.tf.uni-kiel.de/matwis/amat/def_en/kap_5/backbone/r5_1_2.html)
- [IUCr: Wigner–Seitz construction](https://dictionary.iucr.org/Wigner-Seitz_cell)
- [Three.js official documentation](https://threejs.org/docs/)
- [PyVista official documentation](https://docs.pyvista.org/)
- [Panel VTK pane documentation](https://panel.holoviz.org/reference/panes/VTK.html)
- [Plotly 3D chart documentation](https://plotly.com/python/3d-charts/)
- [Google Colab FAQ](https://research.google.com/colaboratory/faq.html)

I derive the Wigner–Seitz shape from the twelve FCC nearest-neighbor bisectors and check it for twelve rhombic faces and a volume of a³/4. The drawing follows that independent construction.
