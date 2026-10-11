/**
 * SULFIDE SENTINELS - AUTHENTIC 3D PRODUCT WEARABLE EXPERIENCE
 * Programmatically generated Three.js 3D model precisely matching the physical reference:
 * - Wide black woven fabric strap loop with side brackets, buckle slider, and Velcro overlap.
 * - Low-profile rectangular ABS outer housing with rounded corners.
 * - Inset brushed silver-gray bezel with three dedicated recessed windows.
 * - LEFT: Large purple replaceable chemical sensing strip.
 * - CENTER: Six individually modeled narrow vertical reference color patches (amber, lime, green, teal, slate gray, charcoal).
 * - RIGHT: Separate green replaceable indicator pad.
 * - Transparent gas-permeable protective membrane above the sensing area.
 * - Full 360° horizontal drag, vertical tilt, kinetic inertia, zoom, view presets, and animated exploded layer separation.
 */

(function () {
  'use strict';

  function isWebGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
                 canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
                 canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initHero3D() {
    const container = document.getElementById('hero-3d-container');
    if (!container || !window.THREE || !isWebGLAvailable()) {
      if (container) container.classList.add('fallback-mode');
      return;
    }

    // -------------------------------------------------------------
    // 1. SCENE, CAMERA & RENDERER SETUP
    // -------------------------------------------------------------
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.035);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.0, 4.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'default'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const canvas = renderer.domElement;
    canvas.id = 'hero-3d-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    // -------------------------------------------------------------
    // 2. STUDIO LIGHTING RIG
    // -------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.5);
    scene.add(ambientLight);

    // Key light: cool studio light to capture metallic bezel bevels
    const keyLight = new THREE.DirectionalLight(0xdbeafe, 3.2);
    keyLight.position.set(3.5, 4.5, 5.0);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Fill light: soft warm amber/gold fill for realistic color pigments
    const fillLight = new THREE.DirectionalLight(0xfef3c7, 2.0);
    fillLight.position.set(-4.0, -1.5, 3.5);
    scene.add(fillLight);

    // Rim light: edge separation on dark black housing and woven strap
    const rimLight = new THREE.PointLight(0x38bdf8, 2.0, 12);
    rimLight.position.set(0, 3.0, -3.0);
    scene.add(rimLight);

    // Soft ground contact plane to catch ambient shadow
    const shadowPlaneGeo = new THREE.PlaneGeometry(10, 8);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.9;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Dynamic 3D Scene Adaptation to Light / Dark Theme
    function updateThemeColors(theme) {
      const isLight = theme === 'light';
      if (isLight) {
        scene.background.setHex(0xe8edf3);
        if (scene.fog) scene.fog.color.setHex(0xe8edf3);
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 2.8;
        keyLight.intensity = 2.8;
        fillLight.intensity = 1.9;
        shadowPlaneMat.opacity = 0.18;
      } else {
        scene.background.setHex(0x070b14);
        if (scene.fog) scene.fog.color.setHex(0x070b14);
        ambientLight.color.setHex(0x0f172a);
        ambientLight.intensity = 2.5;
        keyLight.intensity = 3.2;
        fillLight.intensity = 2.0;
        shadowPlaneMat.opacity = 0.35;
      }
    }

    const themeObserver = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      updateThemeColors(currentTheme);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    updateThemeColors(document.documentElement.getAttribute('data-theme') || 'dark');

    // -------------------------------------------------------------
    // 3. PROCEDURAL PBR TEXTURES (Ballistic Webbing, Reagents, Brushed Metal)
    // -------------------------------------------------------------
    // A. Woven Fabric Webbing Texture (512x512)
    function createWovenWebbingTexture() {
      const tc = document.createElement('canvas');
      tc.width = 512;
      tc.height = 512;
      const ctx = tc.getContext('2d');

      // Base matte black nylon fabric
      ctx.fillStyle = '#14171E';
      ctx.fillRect(0, 0, 512, 512);

      // Authentic cross-hatch twill weave lines
      for (let y = 0; y < 512; y += 8) {
        for (let x = 0; x < 512; x += 8) {
          const isStitch = ((x / 8) + (y / 8)) % 2 === 0;
          ctx.fillStyle = isStitch ? '#222834' : '#11141A';
          ctx.fillRect(x, y, 7, 7);

          // Diagonal weave fiber thread
          ctx.strokeStyle = isStitch ? '#2B3242' : '#0B0D12';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 7, y + 7);
          ctx.stroke();
        }
      }

      // Webbing side border binding lines (top and bottom edges)
      ctx.fillStyle = '#1C222D';
      ctx.fillRect(0, 0, 512, 14);
      ctx.fillRect(0, 498, 512, 14);

      const texture = new THREE.CanvasTexture(tc);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(8, 2);
      texture.anisotropy = 4;
      return texture;
    }

    // B. Purple Sensing Reagent Paper Texture (512x512)
    function createPurplePadTexture() {
      const tc = document.createElement('canvas');
      tc.width = 512;
      tc.height = 512;
      const ctx = tc.getContext('2d');

      // Base lavender-purple reagent color
      ctx.fillStyle = '#8D5CA0';
      ctx.fillRect(0, 0, 512, 512);

      // Subtle paper fibers and mottled chemical density
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const rad = 2 + Math.random() * 5;
        const alpha = 0.08 + Math.random() * 0.12;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(167, 115, 184, ${alpha})` : `rgba(127, 79, 146, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Soft vignette for realistic physical paper look
      const grad = ctx.createRadialGradient(256, 256, 60, 256, 256, 260);
      grad.addColorStop(0, 'rgba(160, 110, 178, 0.25)');
      grad.addColorStop(0.75, 'rgba(141, 92, 160, 0)');
      grad.addColorStop(1, 'rgba(110, 68, 128, 0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      const texture = new THREE.CanvasTexture(tc);
      texture.anisotropy = 4;
      return texture;
    }

    // C. Green Indicator Reagent Pad Texture (512x512)
    function createGreenIndicatorTexture() {
      const tc = document.createElement('canvas');
      tc.width = 512;
      tc.height = 512;
      const ctx = tc.getContext('2d');

      // Base spring/lime-green indicator color
      ctx.fillStyle = '#5EB42C';
      ctx.fillRect(0, 0, 512, 512);

      // Subtle chemical paper fibers
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const rad = 2 + Math.random() * 5;
        const alpha = 0.08 + Math.random() * 0.12;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(121, 202, 71, ${alpha})` : `rgba(85, 168, 36, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Soft vignette
      const grad = ctx.createRadialGradient(256, 256, 60, 256, 256, 260);
      grad.addColorStop(0, 'rgba(125, 208, 75, 0.25)');
      grad.addColorStop(0.75, 'rgba(94, 180, 44, 0)');
      grad.addColorStop(1, 'rgba(70, 145, 30, 0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      const texture = new THREE.CanvasTexture(tc);
      texture.anisotropy = 4;
      return texture;
    }

    // D. Brushed Silver Metallic Bezel Texture (512x512)
    function createBrushedSilverTexture() {
      const tc = document.createElement('canvas');
      tc.width = 512;
      tc.height = 512;
      const ctx = tc.getContext('2d');

      ctx.fillStyle = '#D4D8E0';
      ctx.fillRect(0, 0, 512, 512);

      // Horizontal micro-brush streaks
      for (let y = 0; y < 512; y += 2) {
        const shade = 200 + Math.floor(Math.random() * 45);
        ctx.strokeStyle = `rgb(${shade}, ${shade + 2}, ${shade + 6})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(tc);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    }

    const webbingTexture = createWovenWebbingTexture();
    const purplePadTexture = createPurplePadTexture();
    const greenIndicatorTexture = createGreenIndicatorTexture();
    const brushedSilverTexture = createBrushedSilverTexture();

    // -------------------------------------------------------------
    // 4. GEOMETRY UTILITIES (Rounded Rectangles & Window Holes)
    // -------------------------------------------------------------
    function createRoundedRectShape(w, h, r) {
      const shape = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      shape.moveTo(x + r, y);
      shape.lineTo(x + w - r, y);
      shape.quadraticCurveTo(x + w, y, x + w, y + r);
      shape.lineTo(x + w, y + h - r);
      shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      shape.lineTo(x + r, y + h);
      shape.quadraticCurveTo(x, y + h, x, y + h - r);
      shape.lineTo(x, y + r);
      shape.quadraticCurveTo(x, y, x + r, y);
      return shape;
    }

    function createRectHole(cx, cy, hw, hh, hr) {
      const h = new THREE.Path();
      const hx = cx - hw / 2, hy = cy - hh / 2;
      h.moveTo(hx + hr, hy);
      h.lineTo(hx + hw - hr, hy);
      h.quadraticCurveTo(hx + hw, hy, hx + hw, hy + hr);
      h.lineTo(hx + hw, hy + hh - hr);
      h.quadraticCurveTo(hx + hw, hy + hh, hx + hw - hr, hy + hh);
      h.lineTo(hx + hr, hy + hh);
      h.quadraticCurveTo(hx, hy + hh, hx, hy + hh - hr);
      h.lineTo(hx, hy + hr);
      h.quadraticCurveTo(hx, hy, hx + hr, hy);
      return h;
    }

    // -------------------------------------------------------------
    // 5. ASSEMBLE ACCURATE 3D PRODUCT COMPONENTS
    // -------------------------------------------------------------
    const masterProductGroup = new THREE.Group();
    masterProductGroup.position.set(0, 0.0, 0);
    masterProductGroup.scale.set(0.55, 0.55, 0.55); // Calibrated to fit full wristband loop with cinematic margins
    scene.add(masterProductGroup);

    // Component references for exploded and interaction states
    const components = {
      strap: null,
      housing: null,
      bezel: null,
      purplePad: null,
      colorBar: null,
      greenIndicator: null,
      membrane: null
    };

    // Exploded view separation offsets matching the bottom-left reference image diagram:
    // Strap loops up/back, membrane floats forward/up, housing/bezel in center,
    // and the 3 sensor components (purple pad, color bar, green indicator) drop below in a horizontal row.
    const explodedOffsets = {
      strap: new THREE.Vector3(0, 0.65, -0.70),
      housing: new THREE.Vector3(0, 0.0, 0.0),
      bezel: new THREE.Vector3(0, 0.05, 0.40),
      purplePad: new THREE.Vector3(-1.06, -0.65, 0.45),
      colorBar: new THREE.Vector3(0.0, -0.65, 0.45),
      greenIndicator: new THREE.Vector3(1.06, -0.65, 0.45),
      membrane: new THREE.Vector3(0, 0.42, 1.15)
    };

    const assembledOffsets = {
      strap: new THREE.Vector3(0, 0, 0),
      housing: new THREE.Vector3(0, 0, 0.63),
      purplePad: new THREE.Vector3(-1.06, 0, 0.755),
      colorBar: new THREE.Vector3(0, 0, 0.755),
      greenIndicator: new THREE.Vector3(1.06, 0, 0.755),
      bezel: new THREE.Vector3(0, 0, 0.74),
      membrane: new THREE.Vector3(0, 0, 0.795)
    };

    let isExploded = false;

    // -------------------------------------------------------------
    // A. WOVEN FABRIC STRAP LOOP & FASTENERS (Wide Black Webbing)
    // Centered at (0, 0, 0) in X-Z space
    // -------------------------------------------------------------
    const strapGroup = new THREE.Group();
    masterProductGroup.add(strapGroup);
    components.strap = strapGroup;

    // Centered ergonomic wrist loop in X-Z plane
    const strapPts = [
      new THREE.Vector2(1.83, 0.70),
      new THREE.Vector2(2.05, 0.40),
      new THREE.Vector2(2.12, 0.00),
      new THREE.Vector2(1.95, -0.40),
      new THREE.Vector2(1.55, -0.65),
      new THREE.Vector2(0.50, -0.70),
      new THREE.Vector2(-0.50, -0.70),
      new THREE.Vector2(-1.55, -0.65),
      new THREE.Vector2(-1.95, -0.40),
      new THREE.Vector2(-2.12, 0.00),
      new THREE.Vector2(-2.05, 0.40),
      new THREE.Vector2(-1.83, 0.70),
      new THREE.Vector2(-1.00, 0.66),
      new THREE.Vector2(0.00, 0.66),
      new THREE.Vector2(1.00, 0.66)
    ];

    const strapSpline = new THREE.SplineCurve(strapPts);
    const splinePts = strapSpline.getPoints(120);

    const strapH = 0.66;  // Webbing height matching reference
    const strapT = 0.05;  // Webbing thickness
    const strapPositions = [];
    const strapUVs = [];
    const strapIndices = [];

    for (let i = 0; i <= 120; i++) {
      const p = splinePts[i % splinePts.length];
      const pNext = splinePts[(i + 1) % splinePts.length];
      const pPrev = splinePts[(i - 1 + splinePts.length) % splinePts.length];

      const tx = pNext.x - pPrev.x;
      const tz = pNext.y - pPrev.y;
      const len = Math.hypot(tx, tz) || 1;
      const nx = tz / len;
      const nz = -tx / len;

      const ox = p.x + nx * (strapT / 2);
      const oz = p.y + nz * (strapT / 2);
      const ix = p.x - nx * (strapT / 2);
      const iz = p.y - nz * (strapT / 2);

      const u = (i / 120) * 12;

      strapPositions.push(ox, strapH / 2, oz);
      strapPositions.push(ox, -strapH / 2, oz);
      strapPositions.push(ix, strapH / 2, iz);
      strapPositions.push(ix, -strapH / 2, iz);

      strapUVs.push(u, 1);
      strapUVs.push(u, 0);
      strapUVs.push(u, 1);
      strapUVs.push(u, 0);

      if (i < 120) {
        const b = i * 4;
        const nb = (i + 1) * 4;
        // Outer face
        strapIndices.push(b, b + 1, nb);
        strapIndices.push(b + 1, nb + 1, nb);
        // Inner face
        strapIndices.push(nb + 2, b + 3, b + 2);
        strapIndices.push(nb + 2, nb + 3, b + 3);
        // Top rim
        strapIndices.push(b, nb, b + 2);
        strapIndices.push(nb, nb + 2, b + 2);
        // Bottom rim
        strapIndices.push(b + 1, b + 3, nb + 1);
        strapIndices.push(nb + 1, b + 3, nb + 3);
      }
    }

    const strapSolidGeo = new THREE.BufferGeometry();
    strapSolidGeo.setAttribute('position', new THREE.Float32BufferAttribute(strapPositions, 3));
    strapSolidGeo.setAttribute('uv', new THREE.Float32BufferAttribute(strapUVs, 2));
    strapSolidGeo.setIndex(strapIndices);
    strapSolidGeo.computeVertexNormals();

    const strapMaterial = new THREE.MeshStandardMaterial({
      map: webbingTexture,
      bumpMap: webbingTexture,
      bumpScale: 0.035,
      color: 0x161A22,
      roughness: 0.88,
      metalness: 0.05
    });

    const strapMesh = new THREE.Mesh(strapSolidGeo, strapMaterial);
    strapMesh.castShadow = true;
    strapGroup.add(strapMesh);

    // Left and Right Molded Plastic Strap Brackets / Fastener Sliders
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x11141A,
      roughness: 0.5,
      metalness: 0.25
    });

    const bracketShape = createRoundedRectShape(0.18, 0.74, 0.05);
    const bracketGeo = new THREE.ExtrudeGeometry(bracketShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015
    });

    const bracketLeft = new THREE.Mesh(bracketGeo, bracketMat);
    bracketLeft.position.set(-1.86, 0, 0.64);
    bracketLeft.castShadow = true;
    strapGroup.add(bracketLeft);

    const bracketRight = new THREE.Mesh(bracketGeo, bracketMat);
    bracketRight.position.set(1.86, 0, 0.64);
    bracketRight.castShadow = true;
    strapGroup.add(bracketRight);

    // Rear Buckle Slider (at back of wrist)
    const rearBuckleGeo = new THREE.BoxGeometry(0.52, 0.72, 0.12);
    const rearBuckle = new THREE.Mesh(rearBuckleGeo, bracketMat);
    rearBuckle.position.set(-0.50, 0, -0.72);
    rearBuckle.castShadow = true;
    strapGroup.add(rearBuckle);

    // Rear Velcro Adjustment Overlap Patch (with subtle stitching border)
    const velcroGeo = new THREE.BoxGeometry(0.70, 0.62, 0.03);
    const velcroMat = new THREE.MeshStandardMaterial({
      color: 0x1A202C,
      roughness: 0.95,
      metalness: 0.02
    });
    const velcroPatch = new THREE.Mesh(velcroGeo, velcroMat);
    velcroPatch.position.set(0.35, 0, -0.73);
    strapGroup.add(velcroPatch);

    // -------------------------------------------------------------
    // B. MAIN PLASTIC HOUSING (Low-profile Matte Black ABS)
    // -------------------------------------------------------------
    const housingGroup = new THREE.Group();
    housingGroup.position.copy(assembledOffsets.housing);
    masterProductGroup.add(housingGroup);
    components.housing = housingGroup;

    const housingShape = createRoundedRectShape(3.66, 0.88, 0.22);
    const housingGeo = new THREE.ExtrudeGeometry(housingShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015
    });

    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x13171F,
      roughness: 0.65,
      metalness: 0.18
    });

    const housingMesh = new THREE.Mesh(housingGeo, housingMat);
    housingMesh.position.set(0, 0, -0.06);
    housingMesh.castShadow = true;
    housingGroup.add(housingMesh);

    // Molded side retention wings that cradle the strap
    const wingGeo = new THREE.BoxGeometry(0.20, 0.82, 0.12);
    const wingL = new THREE.Mesh(wingGeo, housingMat);
    wingL.position.set(-1.82, 0, 0.0);
    housingGroup.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, housingMat);
    wingR.position.set(1.82, 0, 0.0);
    housingGroup.add(wingR);

    // Recessed sensor tray floor inside housing
    const trayFloorGeo = new THREE.PlaneGeometry(3.40, 0.72);
    const trayFloorMat = new THREE.MeshStandardMaterial({ color: 0x080B10, roughness: 0.8 });
    const trayFloor = new THREE.Mesh(trayFloorGeo, trayFloorMat);
    trayFloor.position.set(0, 0, 0.06);
    housingGroup.add(trayFloor);

    // -------------------------------------------------------------
    // C. BRUSHED SILVER-GRAY BEZEL (Precision Plate with 3 Cutout Windows)
    // -------------------------------------------------------------
    const bezelGroup = new THREE.Group();
    bezelGroup.position.copy(assembledOffsets.bezel);
    masterProductGroup.add(bezelGroup);
    components.bezel = bezelGroup;

    const bezelShape = createRoundedRectShape(3.42, 0.74, 0.16);
    // Cutout 1 (Left window for Purple Pad)
    bezelShape.holes.push(createRectHole(-1.06, 0.0, 0.70, 0.52, 0.06));
    // Cutout 2 (Center window for 6 Color Patches)
    bezelShape.holes.push(createRectHole(0.00, 0.0, 1.34, 0.52, 0.04));
    // Cutout 3 (Right window for Green Indicator)
    bezelShape.holes.push(createRectHole(1.06, 0.0, 0.70, 0.52, 0.06));

    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012
    });

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xCFD4DC,
      metalness: 0.82,
      roughness: 0.32,
      map: brushedSilverTexture
    });

    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 0, 0.0);
    bezelMesh.castShadow = true;
    bezelGroup.add(bezelMesh);

    // -------------------------------------------------------------
    // D. PURPLE REPLACEABLE CHEMICAL SENSING PAD (LEFT WINDOW)
    // -------------------------------------------------------------
    const purplePadGroup = new THREE.Group();
    purplePadGroup.position.copy(assembledOffsets.purplePad);
    masterProductGroup.add(purplePadGroup);
    components.purplePad = purplePadGroup;

    // White substrate backing edge
    const padBackingGeo = new THREE.BoxGeometry(0.68, 0.50, 0.015);
    const substrateMat = new THREE.MeshStandardMaterial({ color: 0xF8F9FC, roughness: 0.7 });
    const purpleBacking = new THREE.Mesh(padBackingGeo, substrateMat);
    purpleBacking.position.set(0, 0, -0.01);
    purplePadGroup.add(purpleBacking);

    // Purple chemical reagent layer
    const purpleShape = createRoundedRectShape(0.66, 0.48, 0.05);
    const purpleGeo = new THREE.ExtrudeGeometry(purpleShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.006,
      bevelThickness: 0.006
    });

    const purpleMat = new THREE.MeshStandardMaterial({
      map: purplePadTexture,
      bumpMap: purplePadTexture,
      bumpScale: 0.02,
      color: 0x9862AB,
      roughness: 0.78,
      metalness: 0.04
    });

    const purpleMesh = new THREE.Mesh(purpleGeo, purpleMat);
    purpleMesh.position.set(0, 0, 0.0);
    purplePadGroup.add(purpleMesh);

    // -------------------------------------------------------------
    // E. SIX CENTRAL INDIVIDUALLY MODELED COLOR PATCHES (CENTER WINDOW)
    // Arrangement: Amber/Yellow -> Lime -> Green -> Teal -> Slate Gray -> Charcoal
    // -------------------------------------------------------------
    const colorBarGroup = new THREE.Group();
    colorBarGroup.position.copy(assembledOffsets.colorBar);
    masterProductGroup.add(colorBarGroup);
    components.colorBar = colorBarGroup;

    // Carrier substrate strip backing
    const colorSubstrateGeo = new THREE.BoxGeometry(1.32, 0.50, 0.015);
    const colorSubstrate = new THREE.Mesh(colorSubstrateGeo, substrateMat);
    colorSubstrate.position.set(0, 0, -0.01);
    colorBarGroup.add(colorSubstrate);

    // Six calibrated color swatches from the reference with rich saturation
    const patches = [
      { name: 'Amber / Yellow',      hex: 0xD99B0E, roughness: 0.5 },
      { name: 'Yellow-Green / Lime',  hex: 0x9DBE1E, roughness: 0.5 },
      { name: 'Bright Green',        hex: 0x3EAE2B, roughness: 0.5 },
      { name: 'Aqua / Teal',         hex: 0x26988E, roughness: 0.5 },
      { name: 'Slate Gray',          hex: 0x5A707D, roughness: 0.55 },
      { name: 'Dark Charcoal',       hex: 0x22272C, roughness: 0.65 }
    ];

    const patchW = 0.19;
    const patchH = 0.46;
    const patchShape = createRoundedRectShape(patchW, patchH, 0.02);
    const patchGeo = new THREE.ExtrudeGeometry(patchShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.005
    });

    const patchStartX = -0.5125;
    const patchStepX = 0.205;

    patches.forEach((item, idx) => {
      const pMat = new THREE.MeshStandardMaterial({
        color: item.hex,
        roughness: item.roughness,
        metalness: 0.08
      });
      const pMesh = new THREE.Mesh(patchGeo, pMat);
      pMesh.position.set(patchStartX + idx * patchStepX, 0, 0.0);
      colorBarGroup.add(pMesh);
    });

    // -------------------------------------------------------------
    // F. GREEN REPLACEABLE INDICATOR PAD (RIGHT WINDOW)
    // -------------------------------------------------------------
    const greenIndicatorGroup = new THREE.Group();
    greenIndicatorGroup.position.copy(assembledOffsets.greenIndicator);
    masterProductGroup.add(greenIndicatorGroup);
    components.greenIndicator = greenIndicatorGroup;

    // White substrate backing edge
    const greenBacking = new THREE.Mesh(padBackingGeo, substrateMat);
    greenBacking.position.set(0, 0, -0.01);
    greenIndicatorGroup.add(greenBacking);

    // Green indicator chemical layer
    const greenShape = createRoundedRectShape(0.66, 0.48, 0.05);
    const greenGeo = new THREE.ExtrudeGeometry(greenShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.006,
      bevelThickness: 0.006
    });

    const greenMat = new THREE.MeshStandardMaterial({
      map: greenIndicatorTexture,
      bumpMap: greenIndicatorTexture,
      bumpScale: 0.02,
      color: 0x62B82E,
      roughness: 0.78,
      metalness: 0.04
    });

    const greenMesh = new THREE.Mesh(greenGeo, greenMat);
    greenMesh.position.set(0, 0, 0.0);
    greenIndicatorGroup.add(greenMesh);

    // -------------------------------------------------------------
    // G. TRANSPARENT PROTECTIVE GAS-PERMEABLE MEMBRANE
    // -------------------------------------------------------------
    const membraneGroup = new THREE.Group();
    membraneGroup.position.copy(assembledOffsets.membrane);
    masterProductGroup.add(membraneGroup);
    components.membrane = membraneGroup;

    const membraneShape = createRoundedRectShape(3.38, 0.70, 0.15);
    const membraneGeo = new THREE.ExtrudeGeometry(membraneShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008
    });

    // Clean transparent material with depthWrite: false so sensors are 100% visible
    const membraneMat = new THREE.MeshStandardMaterial({
      color: 0xE8F4F8,
      transparent: true,
      opacity: 0.20,
      roughness: 0.12,
      metalness: 0.15,
      depthWrite: false
    });

    const membraneMesh = new THREE.Mesh(membraneGeo, membraneMat);
    membraneMesh.position.set(0, 0, 0.0);
    membraneGroup.add(membraneMesh);

    // -------------------------------------------------------------
    // 6. ANIMATED H2S MOLECULAR SATELLITE (Subtle Background Presence)
    // -------------------------------------------------------------
    const moleculeGroup = new THREE.Group();
    moleculeGroup.position.set(2.4, 0.9, -0.3);
    scene.add(moleculeGroup);

    const sulfurGeo = new THREE.SphereGeometry(0.38, 32, 32);
    const sulfurMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.6,
      roughness: 0.25
    });
    const sulfurMesh = new THREE.Mesh(sulfurGeo, sulfurMat);
    moleculeGroup.add(sulfurMesh);

    const hydrogenGeo = new THREE.SphereGeometry(0.20, 24, 24);
    const hydrogenMat = new THREE.MeshStandardMaterial({
      color: 0xf4f7fb,
      emissive: 0x32d9f5,
      emissiveIntensity: 0.5,
      roughness: 0.25
    });

    const bondRadius = 0.04;
    const bondMat = new THREE.MeshStandardMaterial({ color: 0x32d9f5, emissive: 0x0284c7, emissiveIntensity: 0.35 });

    const h1 = new THREE.Mesh(hydrogenGeo, hydrogenMat);
    h1.position.set(-0.70, -0.55, 0.22);
    moleculeGroup.add(h1);

    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(bondRadius, bondRadius, 0.88, 12), bondMat);
    b1.position.copy(h1.position).multiplyScalar(0.5);
    b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h1.position.clone().normalize());
    moleculeGroup.add(b1);

    const h2 = new THREE.Mesh(hydrogenGeo, hydrogenMat);
    h2.position.set(0.70, -0.55, 0.22);
    moleculeGroup.add(h2);

    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(bondRadius, bondRadius, 0.88, 12), bondMat);
    b2.position.copy(h2.position).multiplyScalar(0.5);
    b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h2.position.clone().normalize());
    moleculeGroup.add(b2);

    // -------------------------------------------------------------
    // 7. INTERACTION STATE & FLUID INERTIA ROTATION
    // -------------------------------------------------------------
    let targetRotation = { x: 0.22, y: 0.0 }; // Direct front perspective showing strap loop and front bezel
    let currentRotation = { x: 0.22, y: 0.0 };
    let velocity = { x: 0, y: 0 };
    let isDragging = false;
    let autoRotate = !prefersReducedMotion;
    let autoRotatePaused = false;
    let previousPointer = { x: 0, y: 0 };

    let targetCameraDistance = 3.8;
    let currentCameraDistance = 3.8;
    const MIN_DISTANCE = 1.6;
    const MAX_DISTANCE = 8.0;

    // Drag pointer events
    canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      autoRotatePaused = true;
      canvas.style.cursor = 'grabbing';
      previousPointer = { x: e.clientX, y: e.clientY };
      velocity = { x: 0, y: 0 };

      const hint = document.getElementById('hero-3d-hint');
      if (hint) hint.classList.add('fade-out');
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - previousPointer.x;
      const dy = e.clientY - previousPointer.y;

      targetRotation.y += dx * 0.009;
      // Clamped vertical rotation (-1.15 to +1.15 rad) for top and underside inspection
      targetRotation.x = Math.max(-1.15, Math.min(1.15, targetRotation.x + dy * 0.008));

      velocity = { x: dx * 0.005, y: dy * 0.005 };
      previousPointer = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
        setTimeout(() => { autoRotatePaused = false; }, 1800);
      }
    });

    // Mouse Wheel / Trackpad Zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.004;
      targetCameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetCameraDistance + zoomDelta));

      const hint = document.getElementById('hero-3d-hint');
      if (hint) hint.classList.add('fade-out');
    }, { passive: false });

    // Touch Pinch Zoom support
    let touchDistance = 0;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        touchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (touchDistance - newDist) * 0.01;
        targetCameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetCameraDistance + delta));
        touchDistance = newDist;
      }
    }, { passive: true });

    // -------------------------------------------------------------
    // 8. CAMERA VIEW PRESETS & EXPLODED VIEW CONTROLS
    // -------------------------------------------------------------
    function setViewPreset(preset) {
      document.querySelectorAll('.btn-preset-view').forEach(b => b.classList.remove('active'));
      const activeBtn = document.querySelector(`.btn-preset-view[data-preset="${preset}"]`);
      if (activeBtn) activeBtn.classList.add('active');

      const hint = document.getElementById('hero-3d-hint');
      if (hint) hint.classList.add('fade-out');

      // Pause auto-rotation when user inspects a specific preset
      autoRotate = false;
      velocity = { x: 0, y: 0 };
      const btnAuto = document.getElementById('btn-3d-autorotate');
      if (btnAuto) btnAuto.classList.remove('active');

      if (preset === 'front') {
        isExploded = false;
        targetRotation = { x: 0.22, y: 0.0 };
        targetCameraDistance = 3.8;
      } else if (preset === 'closeup') {
        // Direct macro zoom on the Purple Sensing Pad and Central 6 Reference Patches
        isExploded = false;
        targetRotation = { x: 0.04, y: 0.0 };
        targetCameraDistance = 1.95;
      } else if (preset === 'side') {
        isExploded = false;
        targetRotation = { x: 0.02, y: Math.PI / 2 };
        targetCameraDistance = 3.8;
      } else if (preset === 'back') {
        // Inspects rear strap, buckle slider, and Velcro overlap
        isExploded = false;
        targetRotation = { x: 0.18, y: Math.PI };
        targetCameraDistance = 3.8;
      } else if (preset === 'exploded') {
        isExploded = true;
        targetRotation = { x: 0.36, y: -0.25 };
        targetCameraDistance = 4.2;
      }
    }

    document.querySelectorAll('.btn-preset-view').forEach(btn => {
      btn.addEventListener('click', () => {
        setViewPreset(btn.dataset.preset);
      });
    });

    // Reset View Button
    const btnReset = document.getElementById('btn-3d-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        isExploded = false;
        targetRotation = { x: 0.22, y: 0.0 };
        targetCameraDistance = 3.8;
        setViewPreset('front');
      });
    }

    // Auto-Rotate Toggle Button
    const btnAutoRotate = document.getElementById('btn-3d-autorotate');
    if (btnAutoRotate) {
      btnAutoRotate.addEventListener('click', () => {
        autoRotate = !autoRotate;
        autoRotatePaused = false;
        btnAutoRotate.classList.toggle('active', autoRotate);
      });
    }

    // -------------------------------------------------------------
    // 9. INTERACTIVE COMPONENT HOTSPOTS & POPOVER
    // -------------------------------------------------------------
    const componentInfo = {
      strap: {
        title: 'Wide Black Woven Fabric Strap',
        desc: 'Wide ballistic nylon webbing with molded side bracket sliders, rear adjustment buckle, and stitched Velcro closure.'
      },
      housing: {
        title: 'ABS Housing & Brushed Silver Bezel',
        desc: 'Low-profile matte black impact-resistant ABS casing with precision brushed silver-gray bezel featuring three recessed sensor windows.'
      },
      'purple-pad': {
        title: 'Purple Chemical Sensing Pad (Left)',
        desc: 'Replaceable chemical reagent paper pad on the left. Darkens progressively upon occupational exposure to airborne H₂S gas.'
      },
      'color-scale': {
        title: 'Six-Patch Optical Reference Scale (Center)',
        desc: 'Six narrow calibrated reference-color patches (amber, lime, green, teal, slate gray, charcoal) for visual comparison and smartphone lighting normalization.'
      },
      'green-indicator': {
        title: 'Green Replaceable Indicator Pad (Right)',
        desc: 'Dedicated chemical indicator on the right providing rapid visual verification of sensor freshness and active operational status.'
      },
      membrane: {
        title: 'Gas-Permeable Protective Membrane',
        desc: 'Thin transparent hydrophobic barrier allowing ambient H₂S gas diffusion while shielding the sensor pads from moisture, sweat, and dust.'
      }
    };

    function highlightComponent(compKey) {
      const info = componentInfo[compKey];
      if (!info) return;

      const card = document.getElementById('hero-3d-component-popover');
      if (card) {
        card.querySelector('.popover-title').textContent = info.title;
        card.querySelector('.popover-desc').textContent = info.desc;
        card.classList.remove('hidden');
      }

      const hint = document.getElementById('hero-3d-hint');
      if (hint) hint.classList.add('fade-out');

      // Move camera to optimal angle for the selected component
      if (compKey === 'purple-pad' || compKey === 'color-scale' || compKey === 'green-indicator') {
        setViewPreset('closeup');
      } else if (compKey === 'strap') {
        setViewPreset('side');
      } else if (compKey === 'membrane') {
        setViewPreset('exploded');
      } else {
        setViewPreset('front');
      }
    }

    document.querySelectorAll('.btn-comp-hotspot').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-comp-hotspot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        highlightComponent(btn.dataset.comp);
      });
    });

    const btnClosePopover = document.getElementById('btn-close-popover');
    if (btnClosePopover) {
      btnClosePopover.addEventListener('click', () => {
        const card = document.getElementById('hero-3d-component-popover');
        if (card) card.classList.add('hidden');
      });
    }

    // -------------------------------------------------------------
    // 10. ANIMATION & RENDER LOOP
    // -------------------------------------------------------------
    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    let isVisible = true;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => isVisible = e.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(container);

    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      if (!isVisible) return;

      const delta = clock.getDelta();

      // Responsive camera distance zoom lerp (aspect-aware to prevent horizontal clipping)
      const canvasAspect = (canvas.clientWidth || 400) / (canvas.clientHeight || 500);
      const aspectFactor = canvasAspect < 1.15 ? Math.min(1.5, 1.15 / canvasAspect) : 1.0;
      const desiredZ = targetCameraDistance * aspectFactor;
      currentCameraDistance += (desiredZ - currentCameraDistance) * 0.08;
      camera.position.z = currentCameraDistance;

      // Handle drag inertia decay
      if (!isDragging) {
        targetRotation.y += velocity.x;
        targetRotation.x = Math.max(-1.15, Math.min(1.15, targetRotation.x + velocity.y));
        velocity.x *= 0.92;
        velocity.y *= 0.92;

        // Gentle auto-rotation when idle
        if (autoRotate && !autoRotatePaused && Math.abs(velocity.x) < 0.001) {
          targetRotation.y += delta * 0.28;
        }
      }

      // Smooth rotation damping via shortest angular distance
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.10;
      let dy = targetRotation.y - currentRotation.y;
      while (dy < -Math.PI) dy += Math.PI * 2;
      while (dy > Math.PI) dy -= Math.PI * 2;
      currentRotation.y += dy * 0.10;

      masterProductGroup.rotation.x = currentRotation.x;
      masterProductGroup.rotation.y = currentRotation.y;

      // Smooth layer separation / reassembly animation
      const lerpSpeed = 0.08;
      const currentTargets = isExploded ? explodedOffsets : assembledOffsets;

      if (components.strap) components.strap.position.lerp(currentTargets.strap, lerpSpeed);
      if (components.housing) components.housing.position.lerp(currentTargets.housing, lerpSpeed);
      if (components.bezel) components.bezel.position.lerp(currentTargets.bezel, lerpSpeed);
      if (components.purplePad) components.purplePad.position.lerp(currentTargets.purplePad, lerpSpeed);
      if (components.colorBar) components.colorBar.position.lerp(currentTargets.colorBar, lerpSpeed);
      if (components.greenIndicator) components.greenIndicator.position.lerp(currentTargets.greenIndicator, lerpSpeed);
      if (components.membrane) components.membrane.position.lerp(currentTargets.membrane, lerpSpeed);

      // Subtle atmospheric hover and satellite molecule orbit
      masterProductGroup.position.y = Math.sin(clock.getElapsedTime() * 1.5) * 0.025;

      if (moleculeGroup) {
        moleculeGroup.rotation.y += delta * 0.4;
        moleculeGroup.rotation.x += delta * 0.2;
        moleculeGroup.position.y = 0.9 + Math.sin(clock.getElapsedTime() * 1.2) * 0.05;
      }

      renderer.render(scene, camera);
    }

    window.hero3D = {
      setViewPreset,
      getRotation: () => ({ current: { ...currentRotation }, target: { ...targetRotation } }),
      isExploded: () => isExploded
    };

    animate();
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
  } else {
    setTimeout(initHero3D, 50);
  }
})();
