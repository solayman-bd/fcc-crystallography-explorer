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

## Output rules

- PNG exports the current view. SVG exports the analytic surface net.
- Reports include the parameters, equations, derived values, state and checks.
- XYZ/CIF/POSCAR export the unique atoms of the configured ideal **bulk FCC supercell**, whatever comparison workspace is open. They leave out ghosts and non-atomic overlays, use explicit supercell fractional coordinates, and say so in their label.
- CIF uses P1 with all unique positions, so it makes no symmetry claims the app hasn't checked.

## My release checklist

Math tests: expected atom counts, primitive metrics, packing identities, low-index surface results, signed arbitrary surfaces, layer membership, translation parity and minimality, plane intersections, zone law and angles, neighbor shells, holes, slip systems, stacking sequence and nonoverlap, reciprocal duality and extinctions, Bragg bounds, mesh clipping volumes and export counts. I also test index ranges and invalid configurations.

Browser checks: all presets, site picking, large supercells, sliders, layer-off behavior, downloads, saved camera round-trips, the tour and the notebook's actual iframe. I confirm the app has no runtime network dependencies. I run the notebook packaging cells, validate the notebook schema and compare the embedded HTML hash with the standalone file. I inspect representative screenshots and fix any misleading visual overlap.

Reporting: I report actual test results and their limits. A local iframe test is not the same as a run inside Google's hosted Colab. I don't claim native Windows or hardware performance checks unless I ran them. I ship usable files with instructions, and I keep ideal teaching geometry clearly apart from advanced physical simulation.
