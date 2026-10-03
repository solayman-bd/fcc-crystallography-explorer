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
    keywords: "surface 2d net planar density primitive square rectangle triangle rhombus",
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
};

/** The 12-step guided tour: [concept, title, preset]. */
export const LESSONS = [
  ["crystal", "Conventional FCC cell", "basic"],
  ["crystal", "Counting shared atoms", "counting"],
  ["primitive", "3D primitive cell", "primitive"],
  ["directions", "Directions & translations", "directions"],
  ["planes", "Miller planes", "planes"],
  ["surface", "Low-index surfaces", "surface001"],
  ["surface", "2D primitive cells", "surface111"],
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
  stacking: "stacking",
  neighbors: "environment",
  interstitials: "environment",
  slip: "slip",
  partials: "slip",
  reciprocal: "reciprocal",
};

/** Teaching scenes. Applying one resets the overlays but keeps a, the element label and colors. */
export const PRESETS = {
  basic: { title: "Basic FCC cell", concept: "crystal", patch: {} },
  counting: {
    title: "Count shared atoms",
    concept: "crystal",
    patch: { clip: true, radius: 0.27 },
  },
  primitive: {
    title: "Conventional vs primitive",
    concept: "primitive",
    patch: { primitive: true, opacity: 0.55, radius: 0.1 },
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
    title: "The (111) plane",
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
  },
  surface001: {
    title: "FCC (001)",
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
    title: "FCC (110)",
    concept: "surface",
    patch: {
      topic: "surface",
      workspace: "surface",
      hkl: [1, 1, 0],
      location: "layer",
      layer: 0,
      netRepeat: 3,
    },
  },
  surface111: {
    title: "FCC (111)",
    concept: "surface",
    patch: {
      topic: "surface",
      workspace: "surface",
      hkl: [1, 1, 1],
      location: "layer",
      layer: 0,
      netRepeat: 3,
    },
  },
  packing: {
    title: "Close-packed contacts",
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
  },
  stacking: {
    title: "FCC ABC stacking",
    concept: "stacking",
    patch: { topic: "stacking", workspace: "stacking", radius: 0.24 },
  },
  neighbors: {
    title: "Twelve nearest neighbors",
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
    title: "FCC slip systems",
    concept: "slip",
    patch: { topic: "slip", slip: true, radius: 0.11, opacity: 0.5 },
  },
  partials: {
    title: "Shockley partial vectors",
    concept: "partials",
    patch: { topic: "slip", partials: true, radius: 0.07, opacity: 0.25 },
  },
  diffraction: {
    title: "FCC diffraction",
    concept: "reciprocal",
    patch: { topic: "reciprocal", workspace: "reciprocal", forbidden: true },
  },
};
