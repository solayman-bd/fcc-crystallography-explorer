# FCC Crystallography Explorer: build specification

This is the specification I built the app against. It sets out what the app must do, the science rules it must follow and how I check it. My design decisions and the full math model are in [FCC-Requirements-Analysis.md](FCC-Requirements-Analysis.md).

I set out to build a complete, interactive teaching lab for **ideal monatomic FCC crystallography**. My priorities are mathematical correctness, conceptual understanding, clear coordinate conventions and reproducible results. I use only free, open-source dependencies. I ship a local edition that works on Windows and a self-contained Google Colab/Jupyter notebook edition. Both reuse one mathematical engine.

## How I work

Before writing code, I review the specification from four angles: crystallographer, educator, scientific-visualization developer and learner. I look for ambiguities and misleading assumptions. Then I write a prioritized requirements document, an interface plan, an architecture decision, the mathematical model, acceptance tests and a development sequence.

After that I implement, test, inspect the views, document and package. I finish the full app, not a proposal or a prototype. I state clearly which advanced physics I leave out.

## Architecture and deliverables

I compare Python/PyVista, Panel/VTK, Dash/Plotly and Three.js on picking, sphere rendering, clipping, transparency, cameras, overlays, local installation and notebook portability. I prefer one shared browser app when that avoids two separate engines and keeps the full interaction in both editions. Python only handles the notebook packaging and an optional localhost launcher.

What I ship:

1. A standalone offline HTML app with all JavaScript, CSS and Three.js bundled in.
2. A notebook that embeds the identical app, with no tunnels, API keys, external CDNs or GPU.
3. The modular source (`src/`) with an exact dependency lockfile, build scripts, a local launcher, tests, license and third-party notices.
4. The final requirements analysis and this specification.

The app needs no paid service, telemetry or external data. Colab is an optional hosted service, and the app must keep running locally without it.

## Science rules I follow

**Coordinates and lattice.** I use conventional cubic coordinates X=r/a and the FCC lattice `{(i,j,k)/2: i+j+k even}`. The default a=4.05 Å is an editable, illustrative value. The element symbol is a label, not a lookup of material properties.

**Counting.** I keep unique periodic atoms apart from visible boundary sites. A closed 1×1×1 drawing has eight corners and six face centers, and periodic sharing gives four atoms. The app has closed, unique and ghost modes, capped fractional boundary spheres, 1–10 independent supercell dimensions, outer/all/no boundaries, selected-cell highlighting, primitive isolation/tiling and explicit coordinate inspection.

**Primitive cell.** I use `p1=(a/2)[011]`, `p2=(a/2)[101]`, `p3=(a/2)[110]`. I derive the length a/√2, the 60° angles and the determinant a³/4. For the advanced view, I build the FCC Wigner–Seitz rhombic dodecahedron from the nearest-neighbor bisectors.

**Directions.** I keep the integer orientation, the multiplier and the origin separate. The app supports custom signed indices, families and repeated arrows. It shows the unit vector, magnitude, axis angles, the translation test for the actual scaled vector, the a/2 parity test, the shortest repeat and the linear density along an occupied row. `a/2[uvw]` is an FCC translation if and only if u+v+w is even. I never describe repeated arrows as repeated lattice sites unless that test holds for the actual vector.

**Planes.** I keep unreduced indices and use `hX+kY+lZ=c`. I separate orientation, exact location, occupied layer, parallel set and cubic symmetry family. I offer canonical c=1, origin, centered, translated and integer-indexed occupied layers. I handle zero and negative indices explicitly. I never silently move a plane that misses the finite box. The app supports extension, labels, highlighting of member atoms, normals, d markers, family animation and a comparison plane/direction.

**Spacings.** I keep three distances apart: the geometric spacing `d=a/|hkl|`, the adjacent occupied-layer gap `Δ=a gcd(k+l,h+l,h+k)/(2|hkl|)`, and the shortest pure normal FCC translation. For (111), the first two are a/√3 and the last is √3a. Scaling the Miller indices changes geometric d, but not Δ or the pure normal repeat. Diffraction selection is a separate calculation.

**Surfaces.** I derive primitive surface cells rigorously for any orientation. I compute an exact primitive integer kernel of `(k+l)m1+(h+l)m2+(h+k)m3=0` in the FCC primitive basis, then Gauss-reduce it with integer unimodular operations. I report the integer coefficients, Cartesian vectors, lengths, angle, area, density and `AΔ=a³/4`. A bounded candidate search does not prove primitivity, so I don't rely on one. The (001), (110) and (111) results must all come out of this one algorithm.

**2D surface view.** The 2D viewer projects **one occupied atomic layer** analytically, not a whole slab or a 3D screenshot. It has the primitive cell, vectors, tiling, in-plane bonds, labels, picking, pan/zoom and SVG export. When I show a larger comparison mesh, I name its convention exactly. I don't suggest that every hkl has a unique conventional surface mesh.

**Stacking.** I implement FCC ABC, HCP-type ABAB and conceptual AAA stacking with explicit lateral registries and an orthonormal frame. The FCC stack must map back to the declared cubic lattice. I use a/√3 layer gaps for close-packed ABC/ABAB and a/√2 for non-overlapping AAA. The app has registry filters/colors, sequences, side/normal views, layer animation and clearly labeled display-only separation. The intrinsic, extrinsic and twin sequences are exact stated constructions. I don't claim a relaxed defect simulation.

**Neighbors.** I compute bulk neighbors from infinite FCC translations around the selected host, including images outside the box. The first three shells are 12, 6 and 24 at a/√2, a and a√(3/2). The app has a cutoff, vectors, bonds and an optional first-shell cuboctahedron. In-plane coordination is reported separately.

**Holes.** I show octahedral and tetrahedral empty sites: 4 and 8 per periodic cell, with 6 and 4 nearest hosts. I report fractional/Cartesian coordinates and hard-sphere radius ratios. A body-center octahedral hole must never turn into a host atom.

**Slip.** I enumerate the twelve unoriented {111}⟨110⟩ slip systems. For each one I show the plane, normal, perfect Burgers vector, zone law and Schmid factor (≤0.5). The optional Shockley dissociation must satisfy exact vector addition and lie in the slip plane. I explain how this vector construction differs from a dislocation-core model.

**Reciprocal space.** I use the convention `pi·bj=2πδij`. I show the BCC reciprocal lattice in units of 2π/a, the selected G and optional markers for forbidden positions. Monatomic FCC reflections are all-even or all-odd. I compute the structure factor, |G|=2π/d, and the first-order Bragg 2θ only when λ≤2d. I label a forbidden geometric angle as an absent peak. I don't invent realistic intensities.

## Interaction and teaching

I organize the interface into seven tasks and four workspaces, with Learn, Calculate, Verify and Layers tabs, instead of one long control list. Every drawing group has an off state. Presets may set up a teaching scene, but normal control changes keep unrelated state.

The app has robust instanced-mesh picking, orthographic/perspective cameras, standard and custom look directions, fit, independent colors/opacities, radius modes and a live legend. I label the coordinate systems and units. Selecting a site shows its ID, conventional fractions, Cartesian Å, supercell fractions, periodic wrapping, owner-cell convention, plane membership, environment and the direct distance from the previous selection.

Every concept explains what it means, its defining equation, what the drawing shows, a common misconception, the current numerical values, a useful experiment, related concepts and authoritative reading. The app has concept search, at least twelve guided lessons, useful presets, JSON save/load including the camera, and error messages for invalid input that keep the previous valid scene.

## Later addition: 3D cell ⇄ 2D net animation

I added a guided, step-by-step animation tied to the "A single atomic layer" panel. It works for every (hkl) the panel accepts, and it computes everything per plane, with nothing hard-coded: the reduced indices, the layer step Δs = gcd(k+l, h+l, h+k)/2, the spacing d = Δs·a/|hkl|, the Gauss-reduced primitive net t1, t2, the centered cell when the net has one, the shortest interlayer shift, the stacking period N (with N·d the shortest lattice vector along [hkl]), A/B/C… layer labels, and the cube-cut polygon of each layer. The in-plane frame e1 = t1/|t1|, e2 = n × e1 is the Surface net frame, so the animation hands off to the 2D view in the same orientation.

Three modes, each a list of steps:

1. **3D cell → 2D net**: cube with 14 balls, the plane and its cube cut, every layer colored with its slice, the view along n ("picture B"), one layer ("picture A"), the layer grown into a net, whether the cube cut is a cell, the primitive and centered cells with live numbers, then the flat Surface net view.
2. **2D net → 3D cell**: one net, the next layer dropping in shifted onto the gaps, stacking to N + 1 layers, a side view showing d and the shift, then the cube axes, where exactly 14 balls fill one conventional cube.
3. **Primitive cells**: the centered 2D cell morphing into the primitive one, then a1, a2, a3 and the primitive rhombohedron (a/√2, 60°, a³/4, 1 atom) with its long diagonal along [111].

Each step is a set of numbers (opacities, offsets along n, morph and growth amounts) plus a camera view; I tween between them over 1100 ms with easeInOutQuad. Captions are templates filled from the computed geometry. The controls are a mode selector, Back/Next, Play/Pause, Replay, a scrubber, speed 0.5×/1×/2× and the ←/→ keys. Changing (hkl) or the layer restarts the mode. Dragging works between tweens and stops auto-rotation. Reduced-motion settings jump straight to end states. Leaving the workspace cancels all timers. Each mode is a lesson in the guided tour.

My acceptance checks: d, the primitive net, the area per atom and N for (001), (110), (111), (112) and (210); area per atom = 1/(planar density) and d × 4/a³ = planar density; exactly 14 balls in the cube in Build mode for every (hkl); (1 −1 0) = (110) and (002) → (001); and the existing tabs, exports, Save/Load and the tour still work.

## Later addition: simple cubic, BCC and HCP, and primitive ⇄ 2D

I extended the animations from FCC to four structures (the structure is now chosen once for the whole app; see the next section):

| Structure | Lattice + basis | Conventional cell | Primitive cell |
|---|---|---|---|
| Simple cubic | a[100], a[010], a[001]; 1 atom | cube, 8 balls, 1 atom | the cube, a³ |
| BCC | a/2[−111], a/2[1−11], a/2[11−1]; 1 atom | cube, 9 balls, 2 atoms | rhombohedron, 109.47°, a³/2 |
| FCC | a/2[011], a/2[101], a/2[110]; 1 atom | cube, 14 balls, 4 atoms | rhombohedron, 60°, a³/4 |
| HCP | a₁, a₂ (120°), c = √(8/3)a; A at 0, B at (⅓, ⅔, ½) | hexagonal prism, 17 balls, 6 atoms | rhombic prism a₁, a₂, c, 2 atoms, (√3/2)a²c |

HCP planes use the axes a₁, a₂, c. The field accepts (h k l) or (h k i l) with i = −(h + k) and rejects any other i. Switching to HCP starts from (0001) unless the plane is already one of the HCP picks (0001), (10−10), (11−20), (10−11), (10−12), and a message says so.

The layer engine works for any lattice + basis: normal G = h b₁ + k b₂ + l b₃, lattice layers Δs = gcd(q)/D apart, and basis atoms either sharing those layers or forming their own in between. That gives alternating gaps (HCP prism planes) and layers with 2 atoms per net cell (HCP (11−20)). Registry letters come from in-plane positions, and the period is N = M·k. FCC goes through the same code and gives the same results as before.

Two new modes walk the full path:

4. **Primitive → 3D → 2D**: the primitive cell with a₁, a₂, a₃ (a₁, a₂, c) and its atoms → the conventional cell → a 3D array of cells (3 × 3 × 3 cubes, or 7 hexagonal prisms × 3 stories) → the array sliced by (hkl), colored by registry → the layers pulled apart along the normal (seen along the lattice rows t₁) → one layer face-on → the layer grown into the infinite net with t₁, t₂.
5. **2D → 3D → primitive**: the same path backwards, ending with auto-rotation on the primitive cell.

The camera fits each step of these modes to the atoms it shows. SC and BCC cells are seen from further off the body diagonal than FCC, because BCC atoms line up along ⟨111⟩. For every structure, the last 3D step hands off to the Surface net view in the same orientation.

My acceptance checks: SC, BCC and HCP tables (d, net lengths and angle, N, net type) for their low-index planes; HCP (0001) ABAB with d = c/2, (10−10) gaps a√3/6 and a√3/3 with ABCD, (11−20) 2 atoms per cell. For every structure and every index triple within ±3: area × lattice-layer step = primitive volume, N·d̄ = the shortest lattice vector along G, the selected layer holds balls of its cell, and the stack fills one cell with exactly 8, 9, 14 or 17 balls. The 3D arrays hold 64, 91, 172 and 187 atoms, and the primitive cells 8, 8, 8 and 9 balls. FCC results are identical to the FCC-only engine on 734 planes. The browser smoke test runs all five modes for all four structures on four planes, and the tour has a lesson for every mode and for BCC and HCP.

## Later addition: one structure for the whole app

The structure choice used to sit in the animation player and the Surface crystallography panel, while everything else stayed FCC. That was confusing: you could pick HCP there and still see an FCC cube in the Crystal view. I moved the choice to the top of **Crystal & unit cells** (state key `structure`, default `fcc`; older saved views with `animStructure` still load). Every topic, workspace, calculation, Verify check and export now follows it, and the player only shows which structure is active.

`bulk.js` gives each structure the same interface the FCC modules had: drawing sites, neighbor shells, holes, plane and direction geometry, the Wigner–Seitz cell, slip systems, partials and diffraction. For FCC it calls the original FCC modules, so FCC output stays exactly the same.

| | Simple cubic | BCC | HCP (ideal) |
|---|---|---|---|
| Example metal | α-Po, a = 3.35 Å | α-Fe, a = 2.8665 Å | Mg, a = 3.21 Å |
| Cell drawn | cube, 8 sites, 1 atom | cube, 9 sites, 2 atoms | hexagonal prism, 17 sites, 6 atoms (option: the a₁, a₂, c unit cell, 9 sites, 2 atoms) |
| Neighbor shells | 6, 12, 8 | 8, 6, 12 | 12, 6, 2 (the same from A and B atoms) |
| First-shell hull | octahedron | cube | anticuboctahedron |
| Holes | 1 cubic hole, r/R = √3 − 1 | 6 octahedral (2/√3 − 1), 12 tetrahedral (√(5/3) − 1) | 2 octahedral, 4 tetrahedral per unit cell |
| Wigner–Seitz cell | cube | truncated octahedron | hexagonal prism |
| Slip | {100}⟨010⟩, 6 | {110}⟨111⟩, 12 | basal 3 + prismatic 3 + pyramidal 6 ⟨a⟩ |
| Partials | none | none | a/3[11−20] = a/3[10−10] + a/3[01−10] |
| Reciprocal lattice | simple cubic | FCC, h + k + l even | hexagonal; absent when h + 2k = 3n and l odd |

Switching structure loads the example metal and lattice parameter unless I have typed my own, sets the neighbor cutoff just past the third shell (as FCC's 1.25 a does), keeps the hole and slip choices only where they exist, and resets an HCP plane to (0001) unless it is already an HCP pick. A message says what changed. The camera fit uses a view direction per structure, so the BCC body center is not hidden behind a corner atom. The Learn text, presets, search and Calculate tables use the selected structure's own words and numbers. The guided tour stays FCC with its BCC and HCP lessons.

The Verify tab runs 26 checks for FCC, 22 for simple cubic and BCC, and 23 for HCP. My acceptance checks: every preset for every structure passes all its Verify checks; all workspaces, exports, Save/Load and the tour run for every structure; the HCP prism shows 17 sites and the unit cell 9; and a differential test against the previous build compares the visible text, the exports, the report, the surface SVG and a fingerprint of the 3D scene for 117 FCC scenarios. Only the two presets that now switch structure differ.

## Output rules

- PNG exports the current view. SVG exports the analytic surface net.
- Reports include the parameters, equations, derived values, state and checks.
- XYZ/CIF/POSCAR export the unique atoms of the configured ideal **bulk supercell** of the selected structure (HCP: a₁, a₂, c cells with γ = 120°), whatever comparison workspace is open. They leave out ghosts and non-atomic overlays, use explicit supercell fractional coordinates, and say so in their label.
- CIF uses P1 with all unique positions, so it makes no symmetry claims the app hasn't checked.

## My release checklist

Math tests: expected atom counts, primitive metrics, packing identities, low-index surface results, signed arbitrary surfaces, layer membership, translation parity and minimality, plane intersections, zone law and angles, neighbor shells, holes, slip systems, stacking sequence and nonoverlap, reciprocal duality and extinctions, Bragg bounds, mesh clipping volumes and export counts. I also test index ranges and invalid configurations.

Browser checks: all presets, site picking, large supercells, sliders, layer-off behavior, downloads, saved camera round-trips, the tour and the notebook's actual iframe. I confirm the app has no runtime network dependencies. I run the notebook packaging cells, validate the notebook schema and compare the embedded HTML hash with the standalone file. I inspect representative screenshots and fix any misleading visual overlap.

Reporting: I report actual test results and their limits. A local iframe test is not the same as a run inside Google's hosted Colab. I don't claim native Windows or hardware performance checks unless I ran them. I ship usable files with instructions, and I keep ideal teaching geometry clearly apart from advanced physical simulation.
