/**
 * Teaching content: concept explanations, references, the guided tour, presets and
 * the sidebar topic groups.
 */

/** Further reading linked from the Learn tab. */
export const REFERENCES = {
  miller: { title: "IUCr · Miller indices", url: "https://dictionary.iucr.org/Miller_indices" },
  reciprocal: {
    title: "IUCr · Reciprocal lattice",
    url: "https://www.iucr.org/what-we-do/education/pamphlets/reciprocal-lattice",
  },
  diffraction: {
    title: "IUCr · Structure factor & Bragg law",
    url: "https://dictionary.iucr.org/Structure_factor",
  },
  faults: {
    title: "Kiel University · Stacking and partials",
    url: "https://www.tf.uni-kiel.de/matwis/amat/def_en/kap_5/backbone/r5_4_1.html",
  },
  burgers: {
    title: "Kiel University · Burgers vectors",
    url: "https://www.tf.uni-kiel.de/matwis/amat/def_en/kap_5/backbone/r5_1_2.html",
  },
  ws: {
    title: "IUCr · Wigner–Seitz construction",
    url: "https://dictionary.iucr.org/Wigner-Seitz_cell",
  },
};

/**
 * Each concept has a title, question, idea, equation, how to read the drawing,
 * a common confusion, an experiment, related concepts and references.
 */
export const CONCEPTS = {
  crystal: {
    title: "One cell. Four atoms. Fourteen visible sites.",
    question: "Why does FCC have four atoms per cell?",
    intro:
      "Extend the cube in all three directions. Each corner is shared by eight cubes, and each face centre by two. Full spheres show where the lattice sites are; fractions tell you how much belongs to one cell.",
    equation: "8 × ⅛ + 6 × ½ = 4",
    view: "The default drawing includes every corner and face centre, including the top face. Unique mode deliberately uses a half-open computational box. Ghost mode completes the visible boundaries with distinguished periodic images.",
    confusion:
      "Four atoms per cell does not mean a conventional-cell drawing should contain only four spheres. An isolated finite cluster also does not use periodic fractional weights.",
    try: "Switch on capped boundary spheres, then compare closed, unique and ghost modes.",
    related: ["primitive", "coordinates", "packing", "neighbors"],
    refs: ["miller"],
    keywords: "counting face centered corners basis pbc periodic supercell",
  },
  primitive: {
    title: "A smaller repeat of the same crystal.",
    question: "How can the primitive cell be smaller than the cube?",
    intro:
      "The conventional cube makes cubic symmetry easy to see. Three shorter face-diagonal translations also tile exactly the same lattice. Their slanted parallelepiped contains one lattice point after sharing.",
    equation: "p₁=(a/2)[011], p₂=(a/2)[101], p₃=(a/2)[110]",
    view: "Purple edges show the 3D primitive cell. Its three lengths are a/√2, its angles 60°, and its volume a³/4. The Wigner–Seitz rhombic dodecahedron has the same primitive volume in a different shape.",
    confusion:
      "Primitive does not mean cubic. A 3D primitive cell is not a 2D primitive surface cell.",
    try: "Isolate the primitive cell, increase its tiling, then compare with Wigner–Seitz.",
    related: ["crystal", "surface", "reciprocal"],
    refs: ["ws", "reciprocal"],
    keywords: "primitive wigner seitz rhombic dodecahedron conventional volume",
  },
  coordinates: {
    title: "A position needs a named coordinate basis.",
    question: "What does a fractional coordinate mean?",
    intro:
      "In conventional cubic coordinates, r=a(X,Y,Z). The same position has supercell fractions (X/Nx,Y/Ny,Z/Nz). Primitive-basis coefficients are another coordinate system.",
    equation: "r = a(X,Y,Z) = a(Nx f₁, Ny f₂, Nz f₃)",
    view: "Click a site to compare conventional fractions, Cartesian Å, supercell fractions and periodic wrapping. The owner-cell index uses a stated floor-and-clamp convention.",
    confusion:
      "Fractional coordinates without a named basis are ambiguous. An outer-boundary sphere can be a periodic image of a site on the opposite boundary.",
    try: "Use a 2×1×1 box and click an atom on its right boundary.",
    related: ["crystal", "directions", "primitive"],
    refs: ["miller"],
    keywords: "fractional cartesian coordinates position",
  },
  directions: {
    title: "Orientation and vector length are different.",
    question: "Is a/2[uvw] an FCC lattice translation?",
    intro:
      "Integer [u v w] defines an orientation in the cubic basis. An actual vector also needs a scale. a[uvw] is always an FCC lattice translation; a/2[uvw] is one when u+v+w is even.",
    equation: "r = (a/2)[i j k], with i+j+k even",
    view: "The arrow label includes its multiplier. A translated arrow has the same direction. A direction family includes all cubic-symmetry-related directed arrows.",
    confusion:
      "[111] is valid even though a/2[111] is not an FCC translation. The shortest pure [111] repeat is √3a, not d111.",
    try: "Compare [110] and [111], then inspect translation parity and the shortest repeat in Calculate.",
    related: ["planes", "spacing", "slip"],
    refs: ["miller"],
    keywords: "direction vector uvw family translation",
  },
  planes: {
    title: "Choose the orientation, then the location.",
    question: "Which exact Miller plane am I seeing?",
    intro:
      "The indices supply a cubic normal; hX+kY+lZ=c supplies the position. The canonical c=1 plane has intercepts a/h, a/k and a/l, with infinity for zero indices.",
    equation: "hX + kY + lZ = c, where X=x/a",
    view: "Centered and translated planes retain their orientation. Highlighted atoms are exact plane members. Negative-index canonical planes may be outside the positive-coordinate box; the app explains this instead of silently moving them.",
    confusion:
      "A symmetry family {hkl}, a set of parallel planes, an actual atomic layer and a slab are different objects. (100) and (200) have the same orientation but different d.",
    try: "Try (1 −1 0), compare canonical/centered locations, and enable a second plane or direction in the comparison controls.",
    related: ["directions", "spacing", "surface", "reciprocal"],
    refs: ["miller"],
    keywords: "miller plane hkl family intercept angle zone law normal",
  },
  spacing: {
    title: "Three distances with different meanings.",
    question: "Why is the [111] repeat three times d111?",
    intro:
      "Geometric d_hkl measures a unit change of c. Occupied atomic layers only occur at allowed c levels. A pure normal translation must return to an equivalent lattice site without a lateral shift.",
    equation: "d=a/|hkl|; Δlayer=ag/(2|hkl|); g=gcd(k+l,h+l,h+k)",
    view: "For (111), layers are a/√3 apart and cycle A→B→C. A repeats after three gaps: √3a. For (001), neighboring atomic layers are a/2 apart, whereas geometric d001=a.",
    confusion:
      "A forbidden FCC(100) reflection does not imply that an FCC(100) surface cannot exist.",
    try: "Compare (001), (002), (110) and (111) in Calculate. Rescaling indices must not change the true atomic-layer spacing.",
    related: ["planes", "stacking", "reciprocal"],
    refs: ["miller", "reciprocal"],
    keywords: "spacing d111 d001 interplanar layer repeat period",
  },
  surface: {
    title: "A 2D lattice inside a 3D crystal.",
    question: "Why is FCC(111) a triangular surface net?",
    intro:
      "Translations within one atomic layer form a two-dimensional lattice. We construct an exact integer kernel in the FCC primitive basis, then reduce its two vectors without changing the lattice.",
    equation: "(k+l)m₁ + (h+l)m₂ + (h+k)m₃ = 0",
    view: "The purple surface cell has one lattice point after sharing. Area times adjacent-layer spacing equals a³/4, certifying a primitive cell. The 2D viewer analytically projects just this layer onto orthogonal in-plane axes.",
    confusion:
      "Projecting all atoms through a thick slab gives a different picture. The dashed integer cubic-translation mesh is not necessarily the primitive surface cell, nor a unique conventional choice.",
    try: "Compare (001), (110), (111) and (210). Calculate shows the actual integer basis; Verify checks primitivity.",
    related: ["planes", "primitive", "packing", "stacking"],
    refs: ["miller"],
    keywords:
      "surface 2d net planar density primitive square rectangle triangle rhombus (001) (110) (111)",
  },
  packing: {
    title: "Touching along a face diagonal.",
    question: "Where does a/√2 come from?",
    intro:
      "The face diagonal connects a corner, a face centre and the opposite corner. Its length a√2 contains two nearest-neighbor distances, or four radii for touching equal spheres.",
    equation: "4R=a√2; dNN=a/√2; APF=π/(3√2)",
    view: "FCC {111} layers are close packed. Each atom has six neighbors in its layer and three in each neighboring layer. The close-packed in-plane directions belong to <110>.",
    confusion:
      "The hard-sphere radius is geometric, not a measured radius of the chosen element. Small display spheres do not change the lattice calculations.",
    try: "Choose hard-sphere mode, open the (111) surface net and inspect the six contacts.",
    related: ["surface", "stacking", "neighbors", "slip"],
    refs: ["faults"],
    keywords: "packing APF hard sphere close packed radius",
  },
  stacking: {
    title: "Same triangular layers, different registries.",
    question: "What changes between ABCABC and ABAB?",
    intro:
      "A, B and C tell you how a triangular layer is shifted sideways. Reusing A on the third layer gives HCP-type ABAB. Using the third registry gives FCC ABCABC.",
    equation: "FCC: ABCABC…     HCP: ABAB…",
    view: "This comparison uses x parallel to cubic [1 −1 0], y parallel to [1 1 −2] and z parallel to [111]. The FCC stack maps back exactly to that cubic lattice. Layer addition, filters and side/normal cameras expose each registry.",
    confusion:
      "The letters are not chemical species. AAA is non-close-packed and uses a/√2 height to avoid overlap. Display separation is an explicit visual exaggeration.",
    try: "Look normal, hide C, then look from the side. Fault and twin presets show stated geometric sequence constructions, not relaxed defect simulations.",
    related: ["spacing", "surface", "packing", "partials"],
    refs: ["faults"],
    keywords: "stacking ABC ABAB AAA hcp intrinsic extrinsic fault twin",
  },
  neighbors: {
    title: "Twelve neighbors, including those beyond the box.",
    question: "Where are all twelve nearest neighbors?",
    intro:
      "A finite drawing does not truncate an infinite crystal. Bulk neighbors come from FCC lattice translations around the chosen host, including periodic images outside the box.",
    equation: "Shells: 12 at a/√2; 6 at a; 24 at a√(3/2)",
    view: "The selected center remains highlighted. Gold spheres and bonds show the included shells. The first-shell coordination hull is a cuboctahedron. A cutoff can remove part of a shell; it does not redefine ideal bulk FCC coordination.",
    confusion:
      "Bulk coordination differs from coordination within a single surface layer or at a terminated, relaxed surface.",
    try: "Select a corner, show the first shell, and count the neighbors outside the cube.",
    related: ["interstitials", "packing", "surface"],
    refs: ["ws"],
    keywords: "neighbors coordination shells nearest cutoff cuboctahedron",
  },
  interstitials: {
    title: "Empty sites between host atoms.",
    question: "How do octahedral and tetrahedral holes differ?",
    intro:
      "Interstitial markers show potential positions between host atoms; they are empty in the ideal monatomic crystal. Octahedral sites have six nearest hosts, tetrahedral sites four.",
    equation: "Octa: 4/cell, r/R=√2−1; Tetra: 8/cell, r/R=√(3/2)−1",
    view: "Pink markers identify octahedral holes and yellow markers tetrahedral holes. Click a marker to connect its hosts. Low host opacity helps pick a hole through the drawing.",
    confusion:
      "The FCC body centre is a hole, not a host atom. Radius ratios assume equal touching, undistorted hard spheres.",
    try: "Click the body-center octahedral marker, then compare a tetrahedral marker at a quarter coordinate.",
    related: ["neighbors", "packing", "crystal"],
    refs: ["miller"],
    keywords: "interstitial octahedral tetrahedral void hole radius",
  },
  slip: {
    title: "A plane plus an in-plane direction.",
    question: "Why are there twelve FCC slip systems?",
    intro:
      "Four unoriented {111} planes each contain three unoriented <110> directions. Their twelve plane/direction pairs are the usual FCC slip systems.",
    equation: "{111}<110>; b=(a/2)<110>; m=|l̂·n̂| |l̂·b̂|",
    view: "The sheet shows a slip plane translated through the box center. The arrow shows its Burgers vector. Calculate lists Schmid factors for all twelve systems; clicking a row selects that system.",
    confusion:
      "Schmid factor is geometric, not yield stress. Opposite Burgers signs count as one system. Directions shared by different planes can overlap in an all-system view.",
    try: "Compare [001], [111] and [123] loading directions. All factors must be at most 0.5.",
    related: ["directions", "planes", "packing", "partials"],
    refs: ["burgers"],
    keywords: "slip system schmid load deformation burgers",
  },
  partials: {
    title: "Two partial vectors sum to one perfect vector.",
    question: "How do Shockley partials add up?",
    intro:
      "A perfect FCC lattice translation can split geometrically into two a/6<112> vectors on a {111} plane. Each partial is not itself an FCC lattice translation.",
    equation: "a/2[1 −1 0] = a/6[2 −1 −1] + a/6[1 −2 1]",
    view: "The two partial arrows are placed head to tail; the third arrow is their sum. Dotting each with [111] gives zero. The perfect magnitude is a/√2, and each partial magnitude a/√6.",
    confusion:
      "This is a Burgers-vector construction. It does not simulate a dislocation line, core, elastic displacement, partial separation or stacking-fault energy.",
    try: "Look along [111] and verify the vector sum, then inspect an intrinsic-fault stacking sequence.",
    related: ["slip", "stacking", "directions"],
    refs: ["faults", "burgers"],
    keywords: "shockley partial dislocation dissociation burgers fault",
  },
  reciprocal: {
    title: "Periodicity expressed as wavevectors.",
    question: "Why are some FCC reflections absent?",
    intro:
      "Equal scatterers at the four conventional FCC positions contribute different phases. Mixed odd/even indices cancel. All-even or all-odd indices add constructively.",
    equation: "F/f=1+(−1)^(k+l)+(−1)^(h+l)+(−1)^(h+k)",
    view: "Purple nodes form the reciprocal BCC lattice, with conventional edge 4π/a. Grid units are 2π/a Å⁻¹. Faint forbidden positions are comparison markers, not reciprocal-lattice nodes; (000) is the forward-scattering origin.",
    confusion:
      "A forbidden reflection does not forbid a real-space surface. The Bragg calculator supplies positions, not realistic intensity, broadening, texture or multiple scattering.",
    try: "Compare (111), (200), (220) with (100), (110), then change wavelength and check λ≤2d.",
    related: ["planes", "spacing", "primitive"],
    refs: ["reciprocal", "diffraction"],
    keywords: "reciprocal diffraction xrd bcc bragg selection forbidden allowed structure factor",
  },
  cellnet: {
    title: "One crystal, two pictures.",
    question: "How do 3D cells and 2D nets fit together?",
    intro:
      "Every Miller-plane family slices a crystal into identical atomic layers. Pick simple cubic, BCC, FCC or HCP and follow one conventional cell as it is cut into layers, flattened into a 2D net and rebuilt by stacking; or walk from the primitive cell to the conventional cell, the 3D array and one 2D layer, and back again.",
    equation: "s = hX + kY + lZ;  d = Δs·a/|hkl|;  area × d = V_primitive (a³, a³/2, a³/4)",
    view: "The player under the view chooses the structure and one of five animations, for the plane and occupied layer of the surface panel. HCP planes use hexagonal axes: (h k l) is written (h k i l) with i = −(h + k). Captions use the current numbers. Back/Next or ←/→ move one step; the scrubber moves continuously.",
    confusion:
      "A shape cut out by the cell walls is not automatically a cell: the (111) triangle cannot tile the plane by translation. Stacked layers repeat only after N layers, where N·d is the shortest lattice vector along the normal. In HCP the B atoms can form layers of their own between the A layers, so the spacings may alternate, as on the (10−10) prism planes.",
    try: "Run 3D cell → 2D net for FCC (111), then BCC (110) and HCP (0001). Run Primitive → 3D → 2D for each structure and compare the atoms per cell: 1, 2, 4 and 6.",
    related: ["surface", "stacking", "primitive", "spacing"],
    refs: ["miller"],
    keywords:
      "animation layers slice stack net 3d 2d deconstruct build primitive conventional array period shift cell sc bcc hcp simple cubic body centered hexagonal close packed",
  },
};

/**
 * What changes for simple cubic, BCC and HCP. Each entry overrides fields of the FCC concept
 * above; fields left out (and the cell ⇄ net concept) read the same for every structure.
 */
const SURFACE_INTRO =
  "Translations within one atomic layer form a two-dimensional lattice. We construct an exact integer kernel in the primitive basis of the structure, then reduce its two vectors without changing the lattice.";

const STRUCTURE_CONCEPTS = {
  sc: {
    crystal: {
      title: "One cell. One atom. Eight visible sites.",
      question: "Why does simple cubic have one atom per cell?",
      intro:
        "Extend the cube in all three directions. Each corner is shared by eight cubes, so the eight corner spheres add up to one atom. Full spheres show where the lattice sites are; fractions tell you how much belongs to one cell.",
      equation: "8 × ⅛ = 1",
      view: "The default drawing includes all eight corners. Unique mode keeps one corner per cell (a half-open computational box). Ghost mode completes the visible boundaries with distinguished periodic images.",
      confusion:
        "One atom per cell does not mean a cell drawing should show one sphere. Simple cubic is rare among metals (polonium); it is the easiest lattice for counting.",
      try: "Switch on capped boundary spheres: eight ⅛ pieces make one atom.",
    },
    primitive: {
      title: "Here the cube is already primitive.",
      question: "Is the simple cubic cell primitive?",
      intro:
        "The three cube edges are the shortest lattice translations, and the cube holds one lattice point after sharing, so it is already the primitive cell. The Wigner–Seitz cell is a cube of the same volume centered on an atom.",
      equation: "p₁=a[100], p₂=a[010], p₃=a[001]; V=a³",
      view: "Purple edges show the primitive cell; for simple cubic they coincide with the conventional cube. The Wigner–Seitz cell is the same cube, shifted to surround one atom.",
      confusion:
        "Conventional and primitive cells are different choices in general, but for simple cubic they are the same cube.",
      try: "Compare the primitive volumes of SC (a³), BCC (a³/2) and FCC (a³/4) with the structure selector.",
    },
    directions: {
      question: "Which vectors along [uvw] are simple cubic translations?",
      intro:
        "Integer [u v w] defines an orientation in the cubic basis. An actual vector also needs a scale. In simple cubic, a[uvw] is a lattice translation and no shorter fraction of a reduced [uvw] is.",
      equation: "r = a[u v w], with u, v, w integers",
      confusion:
        "The shortest pure [111] repeat is √3a, which is three times d₁₁₁ = a/√3, not d₁₁₁ itself.",
    },
    spacing: {
      question: "Why does d equal the layer spacing in simple cubic?",
      intro:
        "Geometric d_hkl measures a unit change of c. In simple cubic every integer level c of reduced (hkl) holds atoms, so the layer spacing equals d_hkl; the pure normal repeat can still span several layers.",
      equation: "d = a/|hkl|; layers at every integer c",
      view: "For (111), layers are a/√3 apart and cycle A→B→C; the pure repeat along [111] is √3a. For (001), layers are a apart and stack straight on top of each other.",
      confusion:
        "Rescaling (111) to (222) halves d_hkl but does not move a single atom: the real layer spacing stays a/√3.",
    },
    surface: {
      intro: SURFACE_INTRO,
      equation: "h·m₁ + k·m₂ + l·m₃ = 0 (primitive basis = cube edges)",
      view: "The purple surface cell has one lattice point after sharing. Area times the layer step equals the primitive volume a³, certifying a primitive cell. The 2D viewer analytically projects just this layer onto orthogonal in-plane axes.",
      try: "Compare (001), (110) and (111). Calculate shows the actual integer basis; Verify checks primitivity.",
    },
    packing: {
      title: "Touching along a cube edge.",
      question: "Where does R = a/2 come from?",
      intro:
        "In simple cubic the nearest neighbors sit along the cube edges, a apart, so touching spheres have 2R = a. They fill only about 52% of space.",
      equation: "2R=a; dNN=a; APF=π/6",
      view: "Simple cubic {100} layers are square nets: each atom has four neighbors in its layer and one directly above and below.",
      try: "Choose hard-sphere mode, open the (001) surface net and count the four contacts.",
    },
    stacking: {
      confusion:
        "The letters are not chemical species. This workspace compares close-packed layers (FCC ABC, HCP ABAB), which simple cubic does not have; the layer stacking of any simple cubic plane is in Cell ⇄ Net.",
    },
    neighbors: {
      title: "Six neighbors, including those beyond the box.",
      question: "Where are the six nearest neighbors in simple cubic?",
      intro:
        "A finite drawing does not truncate an infinite crystal. Bulk neighbors come from lattice translations around the chosen host, including periodic images outside the box.",
      equation: "Shells: 6 at a; 12 at a√2; 8 at a√3",
      view: "The selected center remains highlighted. Gold spheres and bonds show the included shells. The first-shell coordination hull is an octahedron. A cutoff can remove part of a shell; it does not redefine ideal bulk coordination.",
      try: "Select a corner, show the first shell, and count the neighbors outside the cube.",
    },
    interstitials: {
      title: "One large hole in the middle.",
      question: "Where is the simple cubic hole?",
      intro:
        "Interstitial markers show potential positions between host atoms; they are empty in the ideal monatomic crystal. In simple cubic the large hole is the cube center, with eight hosts at a√3/2.",
      equation: "Cubic: 1/cell, 8 hosts, r/R=√3−1",
      view: "Blue markers identify the cubic holes. Click a marker to connect its hosts. Low host opacity helps pick a hole through the drawing.",
      confusion:
        "BCC puts an atom exactly at this position; simple cubic leaves it empty. Radius ratios assume equal touching, undistorted hard spheres.",
      try: "Click the body-center marker and show its eight hosts.",
    },
    slip: {
      question: "Why are there six simple cubic slip systems?",
      intro:
        "Simple cubic slips on {100} planes along ⟨100⟩, its shortest translation: three planes, each containing two in-plane directions.",
      equation: "{100}⟨010⟩; b=a⟨100⟩; m=|l̂·n̂| |l̂·b̂|",
      view: "The sheet shows a slip plane translated through the box center. The arrow shows its Burgers vector. Calculate lists Schmid factors for all six systems; clicking a row selects that system.",
    },
    partials: {
      title: "No simple partials here.",
      question: "Do simple cubic crystals have Shockley partials?",
      intro:
        "Shockley partials split a perfect vector on a close-packed plane and leave a stacking fault between them. Simple cubic has no close-packed plane, so this construction is shown for FCC and HCP.",
      equation: "FCC: a/2⟨110⟩ = a/6⟨211⟩ + a/6⟨121⟩; HCP: a/3⟨11−20⟩ = a/3⟨10−10⟩ + a/3⟨01−10⟩",
      view: "Choose FCC or HCP in Crystal & unit cells to see the partial-vector triangle.",
      try: "Switch to FCC and look along [111] to see the Shockley partials.",
    },
    reciprocal: {
      question: "Why are all simple cubic reflections allowed?",
      intro:
        "With one atom per cube, every (hkl) scatters in phase: the reciprocal lattice is simple cubic with edge 2π/a, and no reflection is absent.",
      equation: "F/f = 1",
      view: "Purple nodes form the reciprocal simple cubic lattice. Grid units are 2π/a Å⁻¹; (000) is the forward-scattering origin.",
      try: "Compare (100), (110) and (111), then change the wavelength and check λ≤2d.",
    },
  },
  bcc: {
    crystal: {
      title: "One cell. Two atoms. Nine visible sites.",
      question: "Why does BCC have two atoms per cell?",
      intro:
        "Extend the cube in all three directions. Each corner is shared by eight cubes; the body center belongs to this cube alone. Full spheres show where the lattice sites are; fractions tell you how much belongs to one cell.",
      equation: "8 × ⅛ + 1 = 2",
      view: "The default drawing includes all eight corners and the body center. Unique mode deliberately uses a half-open computational box. Ghost mode completes the visible boundaries with distinguished periodic images.",
      confusion:
        "The body center is not a different kind of site: it is a corner of the neighboring cubes shifted by a/2[111]. Every BCC atom has the same surroundings.",
      try: "Switch on capped boundary spheres, then compare closed, unique and ghost modes.",
    },
    primitive: {
      question: "How can the BCC primitive cell be half the cube?",
      intro:
        "The conventional cube shows the cubic symmetry. Three translations from a corner to the body centers of neighboring cubes tile exactly the same lattice. Their rhombohedron contains one lattice point after sharing.",
      equation: "p₁=(a/2)[−111], p₂=(a/2)[1−11], p₃=(a/2)[11−1]",
      view: "Purple edges show the 3D primitive cell. Its three lengths are a√3/2, its angles 109.47°, and its volume a³/2. The Wigner–Seitz cell, a truncated octahedron, has the same volume.",
      confusion:
        "Primitive does not mean cubic, and part of the primitive cell lies outside the cube. A 3D primitive cell is not a 2D primitive surface cell.",
    },
    directions: {
      question: "Is a/2[uvw] a BCC lattice translation?",
      intro:
        "Integer [u v w] defines an orientation in the cubic basis. An actual vector also needs a scale. a[uvw] is always a BCC translation; a/2[uvw] is one when u, v and w are all odd, such as a/2[111] to the body center.",
      equation: "r = (a/2)[i j k], with i, j, k all even or all odd",
      confusion:
        "[110] is a valid direction, but a/2[110] is not a BCC translation: the shortest repeat along [110] is a√2. Along [111] it is a√3/2, the nearest-neighbor distance.",
      try: "Compare [100], [110] and [111], then inspect the shortest repeats in Calculate.",
    },
    spacing: {
      question: "Why is d₁₀₀ not the BCC layer spacing?",
      intro:
        "Geometric d_hkl measures a unit change of c. Atoms occupy c levels from the corners and from the body centers: when h + k + l is odd, the body centers add a layer halfway between.",
      equation: "d=a/|hkl|; layers every Δc = ½ (h+k+l odd) or 1 (even)",
      view: "For (001), corner and body-center layers alternate a/2 apart, half of d₀₀₁ = a. For (110), the densest plane, layers are a/√2 apart and stack ABAB. For (111) they cycle ABC, a/(2√3) apart.",
      confusion:
        "The forbidden BCC (100) reflection goes with those extra body-center layers halfway between the (100) planes; it does not mean a BCC (100) surface cannot exist.",
    },
    surface: {
      intro: SURFACE_INTRO,
      equation: "(−h+k+l)m₁ + (h−k+l)m₂ + (h+k−l)m₃ = 0",
      view: "The purple surface cell has one lattice point after sharing. Area times the layer step equals the primitive volume a³/2, certifying a primitive cell. The 2D viewer analytically projects just this layer onto orthogonal in-plane axes.",
      try: "Compare (001), (110) and (111). (110) is the densest BCC plane: a centered-rectangular net.",
    },
    packing: {
      title: "Touching along a body diagonal.",
      question: "Where does R = a√3/4 come from?",
      intro:
        "The body diagonal connects a corner, the body center and the opposite corner. Its length a√3 holds two nearest-neighbor distances, or four radii for touching equal spheres.",
      equation: "4R=a√3; dNN=a√3/2; APF=π√3/8",
      view: "BCC {110} planes are the densest: a centered-rectangular net in which each atom has four in-layer neighbors. The close-packed directions belong to ⟨111⟩.",
      try: "Choose hard-sphere mode, open the (110) surface net and inspect the contacts.",
    },
    stacking: {
      confusion:
        "The letters are not chemical species. This workspace compares close-packed layers (FCC ABC, HCP ABAB), which BCC does not have; the layer stacking of any BCC plane, such as (110) ABAB, is in Cell ⇄ Net.",
    },
    neighbors: {
      title: "Eight neighbors, and six more close behind.",
      question: "Where are the eight nearest neighbors in BCC?",
      intro:
        "A finite drawing does not truncate an infinite crystal. Bulk neighbors come from lattice translations around the chosen host, including periodic images outside the box.",
      equation: "Shells: 8 at a√3/2; 6 at a; 12 at a√2",
      view: "The selected center remains highlighted. Gold spheres and bonds show the included shells. The first-shell coordination hull is a cube. A cutoff can remove part of a shell; it does not redefine ideal bulk coordination.",
      confusion:
        "The six second neighbors are only 15% farther than the first eight, so BCC is often described as 8 + 6 coordinated. Bulk coordination differs from coordination within a single surface layer.",
      try: "Select the body center, show two shells, and compare the distances in Calculate.",
    },
    interstitials: {
      question: "Why are BCC holes smaller than FCC holes?",
      intro:
        "Interstitial markers show potential positions between host atoms; they are empty in the ideal monatomic crystal. BCC octahedral holes sit at face centers and edge midpoints (6 per cell) and are distorted: two hosts at a/2, four at a/√2. Tetrahedral holes, such as (½, ¼, 0), number 12 per cell.",
      equation: "Octa: 6/cell, r/R=2/√3−1; Tetra: 12/cell, r/R=√(5/3)−1",
      confusion:
        "In BCC the tetrahedral holes are larger than the octahedral ones, the reverse of FCC. Carbon in α-iron still prefers the octahedral sites, because it only has to push the two near hosts apart.",
      try: "Click a face-center octahedral marker, then a tetrahedral marker on a face.",
    },
    slip: {
      question: "Why are there twelve BCC {110} slip systems?",
      intro:
        "BCC has no close-packed plane. It slips along the close-packed ⟨111⟩ directions, most often on the six {110} planes, each containing two ⟨111⟩: twelve systems. {112} and {123} planes can also act.",
      equation: "{110}⟨111⟩; b=(a/2)⟨111⟩; m=|l̂·n̂| |l̂·b̂|",
    },
    partials: {
      title: "No simple partials here.",
      question: "Do BCC crystals have Shockley partials?",
      intro:
        "Shockley partials split a perfect vector on a close-packed plane and leave a stacking fault between them. BCC has no close-packed plane, so this construction is shown for FCC and HCP.",
      equation: "FCC: a/2⟨110⟩ = a/6⟨211⟩ + a/6⟨121⟩; HCP: a/3⟨11−20⟩ = a/3⟨10−10⟩ + a/3⟨01−10⟩",
      view: "Choose FCC or HCP in Crystal & unit cells to see the partial-vector triangle.",
      try: "Switch to FCC and look along [111] to see the Shockley partials.",
    },
    reciprocal: {
      question: "Why are some BCC reflections absent?",
      intro:
        "Equal scatterers at the corner and the body center contribute phases that cancel when h + k + l is odd and add when it is even. The allowed nodes form a reciprocal FCC lattice.",
      equation: "F/f = 1 + (−1)^(h+k+l)",
      view: "Purple nodes form the reciprocal FCC lattice, with conventional edge 4π/a. Grid units are 2π/a Å⁻¹. Faint forbidden positions are comparison markers, not reciprocal-lattice nodes; (000) is the forward-scattering origin.",
      try: "Compare (110), (200), (211) with (100), (111), then change wavelength and check λ≤2d.",
    },
  },
  hcp: {
    crystal: {
      title: "A hexagonal prism of three unit cells.",
      question: "Why does the HCP prism hold six atoms?",
      intro:
        "HCP repeats a hexagonal unit cell a₁, a₂, c (a 120° rhombic prism) with two atoms: A at the corners, B inside. Three unit cells make the familiar hexagonal prism: 12 corners shared by six prisms, 2 face centers shared by two, and 3 atoms inside.",
      equation: "12 × ⅙ + 2 × ½ + 3 = 6; unit cell: 8 × ⅛ + 1 = 2",
      view: "The prism drawing shows every corner and face center. Turn the prism off to see the unit-cell supercell, where unique and ghost modes and capped spheres follow the slanted cell faces. The ideal axial ratio c/a = √(8/3) ≈ 1.633.",
      confusion:
        "HCP is not a Bravais lattice: A and B atoms have mirrored surroundings, so the 2-atom basis is part of the structure. The prism is three unit cells, not the primitive cell.",
      try: "Switch on capped boundary spheres and count ⅙ corners, ½ face centers and whole inside atoms.",
    },
    primitive: {
      title: "The unit cell is already primitive.",
      question: "What is the HCP primitive cell?",
      intro:
        "The hexagonal lattice of HCP is spanned by a₁, a₂ (equal, 120° apart) and c. That rhombic prism is primitive for the lattice, but it carries two atoms, A and B: the basis.",
      equation: "a₁ = a[100], a₂ = a[−½ √3/2 0], c = a√(8/3)[001]; V = (√3/2)a²c",
      view: "Purple edges show the primitive cell, the same as the hexagonal unit cell. The Wigner–Seitz cell of the hexagonal lattice is a hexagonal prism of the same volume.",
      confusion:
        "Two atoms per primitive cell does not make the cell non-primitive: the B atom is not a lattice translation of A.",
      try: "Isolate the primitive tiling and find the B atom inside each cell.",
    },
    coordinates: {
      intro:
        "In HCP the unit-cell axes a₁, a₂ and c are not orthogonal, so fractional coordinates (f₁, f₂, f₃) and Cartesian r are related by r = f₁a₁ + f₂a₂ + f₃c. The B atom sits at (⅓, ⅔, ½).",
      equation: "r = f₁a₁ + f₂a₂ + f₃c",
      view: "Click a site to compare unit-cell fractions, Cartesian Å, supercell fractions and periodic wrapping. Turn the prism off to see the unit-cell supercell.",
      try: "Click a B atom and compare its fractions with its Cartesian coordinates.",
    },
    directions: {
      question: "How do HCP directions [u v t w] work?",
      intro:
        "HCP directions use the axes a₁, a₂ (120° apart) and c. The three-index [u v w] means u a₁ + v a₂ + w c; the four-index [u v t w] form adds t = −(u + v), so symmetry-equivalent directions look alike: [2−1−10], [−12−10] and [−1−120] are a₁, a₂ and a₃.",
      equation: "[U V W] → [u v t w] = [(2U−V)/3, (2V−U)/3, −(U+V)/3, W]",
      view: "Arrow labels use the four-index form. Type three or four indices; a four-index direction must have t = −(u + v).",
      confusion:
        "[1 0 0] in three indices is a₁, written [2 −1 −1 0] in four. The shortest translations are a along ⟨11−20⟩ and c along [0001].",
      try: "Compare [2−1−10], [10−10] and [0001] and their shortest repeats in Calculate.",
    },
    planes: {
      question: "How do I read an HCP plane (h k i l)?",
      intro:
        "HCP planes use the axes a₁, a₂ and c. The Miller–Bravais form (h k i l) adds i = −(h + k), so equivalent planes look alike: the six prism planes are (10−10), (01−10), (−1100) and their opposites. The plane h·f₁ + k·f₂ + l·f₃ = c is located like a cubic one, in fractional coordinates.",
      equation: "h f₁ + k f₂ + l f₃ = c; i = −(h + k)",
      view: "Planes are clipped to the hexagonal prism, or to the unit-cell supercell. Highlighted atoms lie exactly on the plane.",
      confusion:
        "In HCP, (h k l) and [h k l] are not perpendicular in general; the plane normal is G = h b₁ + k b₂ + l b₃.",
      try: "Compare (0001), (10−10) and (11−20), then the hexagonal symmetry family of (10−11).",
    },
    spacing: {
      title: "Spacings that alternate.",
      question: "Why do HCP layer spacings alternate?",
      intro:
        "HCP has two atoms per lattice point. On (0001) the B atoms add a layer halfway, so layers are c/2 apart (ABAB). On prism planes such as (10−10) the B layers sit off-center, so the spacings alternate between a√3/6 and a√3/3.",
      equation: "d = 1/|G|, G = h b₁ + k b₂ + l b₃",
      view: "Calculate lists every layer level and spacing. The pure normal repeat is the shortest lattice vector along G.",
      confusion:
        "The layer spacing of a structure with a basis can be unequal; d_hkl alone does not tell you where the atoms are.",
      try: "Compare (0001), (10−10) and (11−20) in Calculate.",
    },
    surface: {
      intro: SURFACE_INTRO,
      equation: "h·m₁ + k·m₂ + l·m₃ = 0 on a₁, a₂, c",
      view: "The purple surface cell has one or two atoms: (0001) and (10−10) layers hold one, (11−20) layers both basis atoms. Area times the lattice-layer step equals the primitive volume (√3/2)a²c.",
      confusion:
        "Projecting all atoms through a thick slab gives a different picture. The dashed integer a₁, a₂, c translation mesh is not necessarily the primitive surface cell.",
      try: "Compare (0001), (10−10) and (11−20). Calculate shows the actual integer basis.",
    },
    packing: {
      title: "Touching in the basal plane.",
      question: "How does HCP reach 74% packing?",
      intro:
        "In each (0001) layer the spheres touch along a₁, so 2R = a. B atoms sit over half of the hollows, touching three A atoms below and three above; the ideal c/a = √(8/3) makes all twelve contacts equal.",
      equation: "2R=a; dNN=a; c/a=√(8/3); APF=π/(3√2)",
      view: "HCP (0001) layers are close packed like FCC {111}; they stack ABAB instead of ABCABC.",
      try: "Choose hard-sphere mode, open the (0001) surface net and inspect the six contacts.",
    },
    stacking: {
      question: "How does HCP stack its close-packed layers?",
      intro:
        "A, B and C tell you how a triangular layer is shifted sideways. HCP reuses A on every second layer (ABAB); FCC uses all three registries (ABCABC).",
      try: "Choose Ideal HCP · ABAB, look normal, then from the side; compare with FCC · ABCABC.",
    },
    neighbors: {
      equation: "Shells: 12 at a; 6 at a√2; 2 at c = a√(8/3)",
      view: "The selected center remains highlighted. Gold spheres and bonds show the included shells. The first-shell coordination hull is an anticuboctahedron. A cutoff can remove part of a shell; it does not redefine ideal bulk coordination.",
      confusion:
        "The twelve HCP neighbors look like FCC's, but the triangles above and below are not rotated: an anticuboctahedron, not a cuboctahedron.",
      try: "Select an atom, show the first shell, and compare it with FCC's.",
    },
    interstitials: {
      question: "Where are the holes in HCP?",
      intro:
        "Interstitial markers show potential positions between host atoms; they are empty in the ideal monatomic crystal. As in FCC, each pair of close-packed layers makes octahedral and tetrahedral holes: 2 octahedral and 4 tetrahedral per unit cell.",
      equation: "Octa: 2/cell, r/R=√2−1; Tetra: 4/cell, r/R=√(3/2)−1",
      confusion:
        "The hole sizes match FCC because both are close packed; only the stacking of the layers that form them differs.",
      try: "Click an octahedral marker between an A and a B layer.",
    },
    slip: {
      question: "Which HCP slip systems share the ⟨a⟩ vector?",
      intro:
        "HCP slips along ⟨11−20⟩ with |b| = a. The basal plane (0001) has 3 systems, the prism planes {10−10} 3 and the first-order pyramidal planes {10−11} 6: twelve ⟨a⟩ systems. None of them can stretch the crystal along c; that needs ⟨c+a⟩ slip or twinning.",
      equation: "b=(a/3)⟨11−20⟩; basal 3 + prismatic 3 + pyramidal 6",
      view: "The sheet shows a slip plane translated through the region center. The arrow shows its Burgers vector. Calculate lists Schmid factors for all twelve systems; clicking a row selects that system.",
      try: "Compare loading along [0001] (all ⟨a⟩ factors are 0) with [2−1−10].",
    },
    partials: {
      title: "Two basal partials sum to one ⟨a⟩ vector.",
      question: "How do HCP basal partials add up?",
      intro:
        "On the basal plane a perfect a/3[11−20] vector can split geometrically into two Shockley partials a/3[10−10] and a/3[01−10], each of length a/√3.",
      equation: "a/3[11−20] = a/3[10−10] + a/3[01−10]",
      view: "The two partial arrows are placed head to tail; the third arrow is their sum. All three lie in (0001). The perfect magnitude is a, and each partial magnitude a/√3.",
      try: "Look along [0001] and verify the vector sum.",
    },
    reciprocal: {
      question: "Why are some HCP reflections absent?",
      intro:
        "The A and B atoms at (0,0,0) and (⅓,⅔,½) scatter with phase 2π(h/3 + 2k/3 + l/2). When h + 2k is a multiple of 3 and l is odd they cancel, so (0001) is absent but (0002) is allowed.",
      equation: "|F/f| = |1 + e^(2πi(h/3 + 2k/3 + l/2))|",
      view: "Purple nodes mark allowed reflections of the hexagonal reciprocal lattice. Grid units are 2π/a Å⁻¹. Faint markers are also reciprocal-lattice nodes: their reflections vanish because the two-atom basis cancels the scattering. Enable extinct reflections to see the full lattice.",
      try: "Compare (0001), (0002) and (10−11), then change the wavelength and check λ≤2d.",
    },
  },
};

/** The concept text for a structure: the FCC text with that structure's overrides. */
export const conceptFor = (key, structure = "fcc") => ({
  ...CONCEPTS[key],
  ...(STRUCTURE_CONCEPTS[structure]?.[key] ?? {}),
});

/** The guided tour: [concept, title, preset]. */
export const LESSONS = [
  ["crystal", "Conventional FCC cell", "basic"],
  ["crystal", "Counting shared atoms", "counting"],
  ["primitive", "3D primitive cell", "primitive"],
  ["directions", "Directions & translations", "directions"],
  ["planes", "Miller planes", "planes"],
  ["surface", "Low-index surfaces", "surface001"],
  ["surface", "2D primitive cells", "surface111"],
  ["cellnet", "3D cell → 2D net", "animDeconstruct"],
  ["cellnet", "2D net → 3D cell", "animBuild"],
  ["cellnet", "Primitive cells, step by step", "animPrimitive"],
  ["cellnet", "Primitive cell → 3D array → 2D layer", "animJourney"],
  ["cellnet", "BCC: 2D layer → primitive cell", "animBcc"],
  ["cellnet", "HCP: ABAB stacking", "animHcp"],
  ["stacking", "ABC stacking", "stacking"],
  ["neighbors", "Neighbors & coordination", "neighbors"],
  ["interstitials", "Interstitial sites", "interstitials"],
  ["slip", "Slip systems", "slip"],
  ["reciprocal", "Reciprocal space & diffraction", "diffraction"],
];

/** Sidebar topic groups: [key, title, default concept]. */
export const TOPICS = [
  ["crystal", "Crystal & unit cells", "crystal"],
  ["geometry", "Directions & planes", "planes"],
  ["surface", "Surface crystallography", "surface"],
  ["stacking", "Atomic stacking", "stacking"],
  ["environment", "Local environment", "neighbors"],
  ["slip", "Slip & Burgers vectors", "slip"],
  ["reciprocal", "Reciprocal & diffraction", "reciprocal"],
];

/** The topic group that each concept belongs to. */
export const CONCEPT_TOPICS = {
  crystal: "crystal",
  primitive: "crystal",
  coordinates: "crystal",
  directions: "geometry",
  planes: "geometry",
  spacing: "geometry",
  surface: "surface",
  packing: "surface",
  cellnet: "surface",
  stacking: "stacking",
  neighbors: "environment",
  interstitials: "environment",
  slip: "slip",
  partials: "slip",
  reciprocal: "reciprocal",
};

/**
 * Teaching scenes. Applying one resets the overlays but keeps a, the element label, the colors
 * and the selected structure. `title` may depend on the structure; `variants` adjust the patch
 * for a structure (HCP planes use a₁, a₂, c); `structure` pins a scene to one structure;
 * `structures` limits where a scene is offered.
 */
const COUNT_WORDS = { 6: "Six", 8: "Eight", 12: "Twelve" };
const HCP_BASAL = { hkl: [0, 0, 1] };

export const PRESETS = {
  basic: { title: (S) => `Basic ${S.short} cell`, concept: "crystal", patch: {} },
  counting: {
    title: "Count shared atoms",
    concept: "crystal",
    patch: { clip: true, radius: 0.27 },
  },
  primitive: {
    title: "Conventional vs primitive",
    concept: "primitive",
    patch: { primitive: true, opacity: 0.55, radius: 0.1 },
    variants: { hcp: { hexPrism: false } },
  },
  directions: {
    title: "Directions & translation",
    concept: "directions",
    patch: {
      topic: "geometry",
      direction: true,
      uvw: [1, -1, 0],
      arrowOrigin: [0, 1, 0],
      radius: 0.1,
    },
  },
  planes: {
    title: (S) => (S.hexagonal ? "The (10−11) plane" : "The (111) plane"),
    concept: "planes",
    patch: {
      topic: "geometry",
      plane: true,
      direction: true,
      normal: true,
      uvw: [1, -1, 0],
      arrowOrigin: [0, 1, 0],
      radius: 0.1,
    },
    variants: { hcp: { hkl: [1, 0, 1], arrowOrigin: [0, 0, 0] } },
  },
  surface001: {
    title: (S) => (S.hexagonal ? "HCP (0001)" : `${S.short} (001)`),
    concept: "surface",
    patch: {
      topic: "surface",
      workspace: "surface",
      hkl: [0, 0, 1],
      location: "layer",
      layer: 0,
      netRepeat: 3,
    },
  },
  surface110: {
    title: (S) => (S.hexagonal ? "HCP (10−10)" : `${S.short} (110)`),
    concept: "surface",
    patch: {
      topic: "surface",
      workspace: "surface",
      hkl: [1, 1, 0],
      location: "layer",
      layer: 0,
      netRepeat: 3,
    },
    variants: { hcp: { hkl: [1, 0, 0] } },
  },
  surface111: {
    title: (S) => (S.hexagonal ? "HCP (11−20)" : `${S.short} (111)`),
    concept: "surface",
    patch: {
      topic: "surface",
      workspace: "surface",
      hkl: [1, 1, 1],
      location: "layer",
      layer: 0,
      netRepeat: 3,
    },
    variants: { hcp: { hkl: [1, 1, 0] } },
  },
  packing: {
    title: (S) =>
      ["fcc", "hcp"].includes(S.key) ? "Close-packed contacts" : `${S.short} touching contacts`,
    concept: "packing",
    patch: {
      topic: "surface",
      workspace: "surface",
      hkl: [1, 1, 1],
      radiusMode: "physical",
      location: "layer",
      layer: 0,
      netRepeat: 2,
    },
    variants: { sc: { hkl: [0, 0, 1] }, bcc: { hkl: [1, 1, 0] }, hcp: HCP_BASAL },
  },
  stacking: {
    title: (S) => (S.hexagonal ? "HCP ABAB stacking" : "FCC ABC stacking"),
    concept: "stacking",
    patch: { topic: "stacking", workspace: "stacking", radius: 0.24 },
    variants: { hcp: { stack: "hcp" } },
  },
  neighbors: {
    title: (S) => `${COUNT_WORDS[S.coordination]} nearest neighbors`,
    concept: "neighbors",
    patch: {
      topic: "environment",
      neighbors: true,
      bonds: true,
      hull: true,
      radius: 0.13,
      opacity: 0.55,
    },
  },
  interstitials: {
    title: "Interstitial sites",
    concept: "interstitials",
    patch: { topic: "environment", holes: "both", radius: 0.17, opacity: 0.24 },
  },
  slip: {
    title: (S) => `${S.short} slip systems`,
    concept: "slip",
    patch: { topic: "slip", slip: true, radius: 0.11, opacity: 0.5 },
  },
  partials: {
    title: (S) => (S.hexagonal ? "Basal partial vectors" : "Shockley partial vectors"),
    concept: "partials",
    patch: { topic: "slip", partials: true, radius: 0.07, opacity: 0.25 },
    structures: ["fcc", "hcp"],
  },
  diffraction: {
    title: (S) => `${S.short} diffraction`,
    concept: "reciprocal",
    patch: { topic: "reciprocal", workspace: "reciprocal", forbidden: true },
    variants: { bcc: { reflection: [1, 1, 0] }, hcp: { reflection: [0, 0, 2] } },
  },
  animDeconstruct: {
    title: "Animate: 3D cell → 2D net",
    concept: "cellnet",
    patch: {
      topic: "surface",
      workspace: "animation",
      animMode: "deconstruct",
      hkl: [1, 1, 1],
      location: "layer",
      layer: 1,
    },
    variants: { hcp: HCP_BASAL },
  },
  animBuild: {
    title: "Animate: 2D net → 3D cell",
    concept: "cellnet",
    patch: {
      topic: "surface",
      workspace: "animation",
      animMode: "build",
      hkl: [1, 1, 1],
      location: "layer",
      layer: 0,
    },
    variants: { hcp: HCP_BASAL },
  },
  animPrimitive: {
    title: "Animate: primitive cells",
    concept: "cellnet",
    patch: {
      topic: "surface",
      workspace: "animation",
      animMode: "primitive",
      hkl: [0, 0, 1],
      location: "layer",
      layer: 1,
    },
  },
  animJourney: {
    title: "Animate: primitive → 3D → 2D",
    concept: "cellnet",
    patch: {
      topic: "surface",
      workspace: "animation",
      animMode: "primToNet",
      hkl: [1, 1, 1],
      location: "layer",
      layer: 1,
    },
    variants: { hcp: HCP_BASAL },
  },
  animBcc: {
    title: "Animate: BCC (110) → primitive",
    concept: "cellnet",
    structure: "bcc",
    patch: {
      topic: "surface",
      workspace: "animation",
      animMode: "netToPrim",
      hkl: [1, 1, 0],
      location: "layer",
      layer: 1,
    },
  },
  animHcp: {
    title: "Animate: HCP ABAB stacking",
    concept: "cellnet",
    structure: "hcp",
    patch: {
      topic: "surface",
      workspace: "animation",
      animMode: "build",
      hkl: [0, 0, 1],
      location: "layer",
      layer: 0,
    },
  },
};

/** A preset's title for a structure. */
export const presetTitle = (preset, S) =>
  typeof preset.title === "function" ? preset.title(S) : preset.title;
