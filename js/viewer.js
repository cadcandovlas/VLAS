// Viewer with custom camera angle - using global THREE objects
console.log('=== Viewer Loading ===');

// Wait for THREE to be ready
function waitForTHREE() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.THREE !== 'undefined') {
                resolve(window.THREE);
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

// Wait for DOM
function waitForDOM() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

// Generate UVs for cube-like meshes (runtime fix for Inventor GLB)
function generateUVsForCube(THREE, geometry, name = '') {
    if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
    }

    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const pos = geometry.attributes.position;
    const uv = [];

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        // Decide projection axis by dominant component
        const ax = Math.abs(x);
        const ay = Math.abs(y);
        const az = Math.abs(z);

        if (az >= ax && az >= ay) {
            // Front/back → map X/Y
            uv.push(
                (x - bbox.min.x) / (size.x || 1),
                (y - bbox.min.y) / (size.y || 1)
            );
        } else if (ax >= ay) {
            // Left/right → map Z/Y
            uv.push(
                (z - bbox.min.z) / (size.z || 1),
                (y - bbox.min.y) / (size.y || 1)
            );
        } else {
            // Top/bottom → map X/Z
            uv.push(
                (x - bbox.min.x) / (size.x || 1),
                (z - bbox.min.z) / (size.z || 1)
            );
        }
    }

    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.attributes.uv.needsUpdate = true;

    console.log(`✓ UVs generated for: ${name || '(mesh)'}`);
}

// Main viewer
(async () => {
    console.log('Waiting for DOM...');
    await waitForDOM();
    console.log('✓ DOM ready');
    
    const THREE = await waitForTHREE();
    console.log('✓ THREE ready, version:', THREE.REVISION);

    const container = document.getElementById('viewer');
    if (!container) {
        console.error('✗ No viewer container found!');
        return;
    }
    console.log('✓ Viewer container found');

    const W = container.clientWidth || 800;
    const H = container.clientHeight || 600;
    console.log('Container size:', W, 'x', H);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100000);
    camera.position.set(100, 100, 100);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        precision: 'highp',
        powerPreference: 'high-performance'
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    console.log('✓ Renderer created and attached');

    // Lights - Dramatic setup for text depth/shadow effect
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);
    console.log('✓ Ambient light added');

    // Main directional light - positioned for dramatic text shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    directionalLight.position.set(150, 200, 150);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 2000;
    directionalLight.shadow.bias = -0.0008;
    directionalLight.shadow.normalBias = 0.02;
    scene.add(directionalLight);
    console.log('✓ Directional light added');

    // Subtle fill light to prevent pure black shadows
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.45);
    fillLight.position.set(-250, -250, -150);
    scene.add(fillLight);
    console.log('✓ Fill light added');

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.autoRotate = false;  // Disabled - model rotation now driven by spiral animation
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    console.log('✓ Orbit controls created');

    let model = null;

    // Spiral pulse data
let cubeSpiralData = [];
let spiralReady = false;
let lastTime = 0;
let pulseDebugCounter = 0;
let pulseFirstRun = true;
let pulseStartTimes = {}; // Track when each cube started pulsing to allow smooth completion

// Motion constants
const PULSE_AMPLITUDE = 3.0;     // 3.0m extension (scale-based pulse works!)
const PULSE_PERIOD   = 3.0;      // seconds for a full pulse cycle
const ROTATION_SPEED = 0.1875;   // lattice rotation speed (CW) - slowed 25% from 0.25


    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        const now = performance.now() * 0.001; // seconds
        const delta = lastTime ? (now - lastTime) : 0;
        lastTime = now;
        
        // Debug: log periodically to confirm animation is running
        pulseDebugCounter++;
        if (pulseDebugCounter % 300 === 0) {
            console.log(`Animation running: now=${now.toFixed(2)}s, spiralReady=${spiralReady}`);
        }

        // Lattice rotation (CW when viewed from above)
        if (model) {
            model.rotation.y -= ROTATION_SPEED * delta;
        }

        // Spiral Pulse animation (DOF-respecting vertical/radial movement)
        if (spiralReady && cubeSpiralData.length > 0) {
            const totalCubes = cubeSpiralData.length;
            const perCubeDelay = 30.0 / totalCubes;  // Full spiral wave: 30 seconds for one complete 360° pass through all cubes
            const LAYER_CYCLE_PERIOD = 30.0; // One complete spiral pass per layer (30s per layer cycle)

            // Determine which layer should be active in the spiral
            // Layers: 3 (top), 2 (middle), 1 (bottom)
            // Each layer gets active for ~1/3 of the full cycle
            const spiralProgress = (now % LAYER_CYCLE_PERIOD) / LAYER_CYCLE_PERIOD; // 0..1
            let activeLayer;
            if (spiralProgress < 0.33) {
                activeLayer = 3; // Top layer active
            } else if (spiralProgress < 0.67) {
                activeLayer = 2; // Middle layer active
            } else {
                activeLayer = 1; // Bottom layer active
            }

            for (const c of cubeSpiralData) {
                const mesh = c.mesh;
                
                // Determine if this is a vertical cube (has Z component in outward direction)
                // Vertical cubes: 113 (+Z), 111 (-Z) with maxOffset = 0.25
                const isVertical = Math.abs(c.outward.z) > 0.5;
                
                // Parse cube position from name (Cube_X_Y_Z)
                const nameParts = mesh.name.split('_');
                const cubeX = parseInt(nameParts[1]);
                const cubeY = parseInt(nameParts[2]);
                const cubeZ = parseInt(nameParts[3]);
                
                // Corner cubes: both X and Y at extremes (0,0), (0,2), (2,0), (2,2)
                const isCornerCube = (cubeX === 0 || cubeX === 2) && (cubeY === 0 || cubeY === 2);
                
                // Cube_1_0_3 is unlocked (special case)
                const isUnlockedCube = (cubeX === 1 && cubeY === 0 && cubeZ === 3);
                
                // Side cubes that CAN pulse: corners OR the unlocked Cube_1_0_3
                const isSidesCube = c.maxOffset > 0 && !isVertical && (isCornerCube || isUnlockedCube);
                
                // Time offset for this cube in the spiral
                let localTime = now - c.phaseIndex * perCubeDelay;
                
                // Special offset for TOP cube (TL) only, to stagger from side cubes
                // Offset by half the pulse period so it pulses during gaps
                if (isVertical && mesh.name === 'Cube_1_1_3') {
                    localTime += PULSE_PERIOD / 2;
                }
                
                // Bottom cube (RE2) naturally alternates from top (no extra offset)
                
                // All cubes use same 3-second pulse period
                const activePulsePeriod = PULSE_PERIOD;
                
                // Wrap into [0, activePulsePeriod)
                const t = ((localTime % activePulsePeriod) + activePulsePeriod) % activePulsePeriod;
                const phase = t / activePulsePeriod; // 0..1

                // Smooth extend/retract using cubic easing (smoother acceleration/deceleration)
                let smoothPhase;
                if (phase < 0.5) {
                    // Extension phase: ease-in-out for smooth acceleration
                    const p = phase * 2; // 0..1
                    smoothPhase = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
                } else {
                    // Retraction phase: ease-out for smooth deceleration
                    const p = (phase - 0.5) * 2; // 0..1
                    smoothPhase = 1 - Math.pow(1 - p, 3);
                    smoothPhase = 1 - smoothPhase; // Invert for retraction
                }
                const s = smoothPhase; // 0..1..0 with cubic easing
                
                // Determine pulsing behavior based on cube type
                let shouldPulse;
                
                if (isVertical) {
                    // Vertical cubes pulse ONLY at the start of their layer activation, not during spiral sequence
                    // They get the first PULSE_PERIOD (3s) of their layer being active
                    const timeIntoLayerCycle = now % LAYER_CYCLE_PERIOD;
                    
                    // Calculate when each layer's window starts (layer 3 at 0s, layer 2 at 6s, layer 1 at 12s)
                    const layerStartTime = (3 - c.layer) * (LAYER_CYCLE_PERIOD / 3);
                    const timeSinceLayerStart = (timeIntoLayerCycle - layerStartTime + LAYER_CYCLE_PERIOD) % LAYER_CYCLE_PERIOD;
                    
                    shouldPulse = (c.layer === activeLayer) && (timeSinceLayerStart < PULSE_PERIOD);
                    
                    // For vertical cubes, use layer-cycle time for animation phase
                    if (shouldPulse) {
                        localTime = timeSinceLayerStart;  // Use time from start of this layer's window
                        // Recalculate phase based on layer cycle time
                        const t2 = ((localTime % PULSE_PERIOD) + PULSE_PERIOD) % PULSE_PERIOD;
                        const phase2 = t2 / PULSE_PERIOD;
                        let smoothPhase2;
                        if (phase2 < 0.5) {
                            const p = phase2 * 2;
                            smoothPhase2 = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
                        } else {
                            const p = (phase2 - 0.5) * 2;
                            smoothPhase2 = 1 - Math.pow(1 - p, 3);
                            smoothPhase2 = 1 - smoothPhase2;
                        }
                        smoothPhase = smoothPhase2;  // Override with layer-based phase
                    }
                } else {
                    // Side cubes use normal spiral-based timing during their active layer
                    // Add extended smooth fade-out/fade-in at layer boundaries
                    shouldPulse = c.layer === activeLayer;
                    
                    // Calculate time until next layer change for fade-out effect
                    const nextLayerChangeTime = Math.ceil(spiralProgress * 3) * (LAYER_CYCLE_PERIOD / 3);
                    const timeUntilLayerChange = nextLayerChangeTime - (now % LAYER_CYCLE_PERIOD);
                    const fadeOutDuration = 1.0; // 1000ms extended fade-out
                    
                    // Calculate time since layer became active for fade-in effect
                    const currentLayerStartTime = Math.floor(spiralProgress * 3) * (LAYER_CYCLE_PERIOD / 3);
                    let timeSinceLayerStart = (now % LAYER_CYCLE_PERIOD) - currentLayerStartTime;
                    if (timeSinceLayerStart < 0) timeSinceLayerStart += LAYER_CYCLE_PERIOD;
                    const fadeInDuration = 0.8; // 800ms extended fade-in
                    
                    if (shouldPulse && timeSinceLayerStart < fadeInDuration) {
                        // Fade in as we enter the new layer
                        const fadeInAmount = timeSinceLayerStart / fadeInDuration;  // 0..1
                        smoothPhase *= fadeInAmount;
                    } else if (timeUntilLayerChange < fadeOutDuration && timeUntilLayerChange > 0) {
                        // Fade out as we approach layer change
                        const fadeOutAmount = timeUntilLayerChange / fadeOutDuration;  // 0..1
                        smoothPhase *= fadeOutAmount;
                    }
                }
                
                const pulseAmount = shouldPulse ? smoothPhase : 0;
                
                const scaleAmount = 1.0 + (pulseAmount * 0.15);
                
                if (isVertical) {
                    // Vertical cubes (113, 111): scale ONLY in Z axis (their DOF), move only in Z
                    mesh.scale.set(1.0, 1.0, scaleAmount);
                    // Position: only modify Z (using outward.z which is ±1)
                    const offset = s * c.maxOffset * c.outward.z;
                    mesh.position.x = c.originalMeshPos.x;
                    mesh.position.y = c.originalMeshPos.y;
                    mesh.position.z = c.originalMeshPos.z + offset;
                } else if (c.maxOffset > 0) {
                    // Side cubes: scale and move ONLY if in active layer
                    if (shouldPulse) {
                        // Active layer: scale ONLY in their DOF axis, move in DOF direction
                        const scaleX = Math.abs(c.outward.x) > 0.5 ? scaleAmount : 1.0;
                        const scaleY = Math.abs(c.outward.y) > 0.5 ? scaleAmount : 1.0;
                        const scaleZ = Math.abs(c.outward.z) > 0.5 ? scaleAmount : 1.0;
                        mesh.scale.set(scaleX, scaleY, scaleZ);
                        
                        // Position: only modify the DOF axis (where outward is non-zero)
                        const offset = pulseAmount * c.maxOffset;
                        const posOffset = c.outward.clone().multiplyScalar(offset);
                        mesh.position.x = c.originalMeshPos.x + posOffset.x;
                        mesh.position.y = c.originalMeshPos.y + posOffset.y;
                        mesh.position.z = c.originalMeshPos.z + posOffset.z;
                    } else {
                        // Inactive layer: stay at rest position, no pulsing
                        mesh.scale.set(1.0, 1.0, 1.0);
                        mesh.position.copy(c.originalMeshPos);
                    }
                } else {
                    // Center cube (112): no movement or scaling
                    mesh.scale.set(1.0, 1.0, 1.0);
                    mesh.position.copy(c.originalMeshPos);
                }
            }
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    console.log('✓ Animation loop started');

    // Monitor all 12 center column cubes for location/scale changes
    let monitoringInterval = setInterval(() => {
        if (!spiralReady || !cubeSpiralData.length) return;
        
        // Track ALL 12 center column cubes: (0,1,Z), (2,1,Z), (1,0,Z), (1,2,Z) for Z=1,2,3
        const centerColumnCubes = cubeSpiralData.filter(c => {
            // Must be a side cube with maxOffset > 0 (not grounded center)
            // AND must be part of the 4 cross directions
            const isXAxis = (Math.abs(c.outward.x) > 0.5); // (0,1,Z) or (2,1,Z)
            const isYAxis = (Math.abs(c.outward.y) > 0.5); // (1,0,Z) or (1,2,Z)
            return c.maxOffset > 0 && (isXAxis || isYAxis);
        });
        
        if (centerColumnCubes.length === 0) {
            console.log('WARNING: No center column cubes found!');
            return;
        }
        
        // Get current layer from spiral timing
        const spiralProgress = (performance.now() * 0.001 % 30.0) / 30.0;
        let activeLayer;
        if (spiralProgress < 0.33) activeLayer = 3;
        else if (spiralProgress < 0.67) activeLayer = 2;
        else activeLayer = 1;
        
        console.log(`\n=== CENTER COLUMN TRACKING (${centerColumnCubes.length} cubes) | Active Layer: ${activeLayer} ===`);
        centerColumnCubes.forEach(c => {
            const pos = c.mesh.position;
            const origPos = c.originalMeshPos;
            const scale = c.mesh.scale;
            const outward = c.outward;
            const isActive = c.layer === activeLayer;
            const posChange = pos.clone().sub(origPos);
            const distance = posChange.length();
            console.log(`${c.mesh.name} (L${c.layer}${isActive ? '✓' : ' '}): pos change(${posChange.x.toFixed(2)},${posChange.y.toFixed(2)},${posChange.z.toFixed(2)}) dist=${distance.toFixed(2)} | scale(${scale.x.toFixed(2)},${scale.y.toFixed(2)},${scale.z.toFixed(2)}) | outward(${outward.x.toFixed(1)},${outward.y.toFixed(1)},${outward.z.toFixed(1)})`);
        });
    }, 2000); // Update every 2 seconds
    
    console.log('✓ Central column coordinate tracking initialized');

    // Load model
    console.log('\n=== Loading Model ===');
    const modelPath = 'models/VLAS_ASSEMBLY_MASTER_Blender.glb';
    console.log('Loading from:', modelPath);

    try {
        const response = await fetch(modelPath);
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('Downloaded:', Math.round(arrayBuffer.byteLength / 1024 / 1024) + 'MB');

        if (typeof THREE.GLTFLoader === 'undefined') {
            throw new Error('GLTFLoader not available');
        }

        const loader = new THREE.GLTFLoader();
        const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);

        loader.load(
            url,
            (gltf) => {
                console.log('✓✓✓ MODEL LOADED ✓✓✓');

                model = gltf.scene;
                scene.add(model);

                // --- Spiral Pulse: collect cube data and build spiral order ---

                // Compute overall center in WORLD space initially, then convert
                const bbox = new THREE.Box3().setFromObject(model);
                const center = bbox.getCenter(new THREE.Vector3());

                // Collect cube meshes (assumes each cube is one mesh)
                cubeSpiralData = [];
                model.traverse((obj) => {
                    if (!obj.isMesh) return;

                    const geo = obj.geometry;
                    if (!geo.attributes.position) return;

                    // Store original vertex positions (don't modify the original)
                    const originalPositions = new Float32Array(geo.attributes.position.array);
                    
                    // Compute this cube's center from its geometry
                    const posAttr = geo.attributes.position;
                    const positions = posAttr.array;
                    let minX = Infinity, maxX = -Infinity;
                    let minY = Infinity, maxY = -Infinity;
                    let minZ = Infinity, maxZ = -Infinity;
                    
                    for (let i = 0; i < positions.length; i += 3) {
                        minX = Math.min(minX, positions[i]);
                        maxX = Math.max(maxX, positions[i]);
                        minY = Math.min(minY, positions[i+1]);
                        maxY = Math.max(maxY, positions[i+1]);
                        minZ = Math.min(minZ, positions[i+2]);
                        maxZ = Math.max(maxZ, positions[i+2]);
                    }
                    
                    const cubeCenterLocal = new THREE.Vector3(
                        (minX + maxX) / 2,
                        (minY + maxY) / 2,
                        (minZ + maxZ) / 2
                    );
                    
                    // Get world position of this cube for calculating outward direction
                    const worldPos = new THREE.Vector3();
                    obj.getWorldPosition(worldPos);
                    
                    // Convert to model-local for outward calculation relative to overall center
                    const localPos = model.worldToLocal(worldPos.clone());
                    
                    // Determine DOF based on cube name classification
                    // Cube_1_1_2 = 112 (center, grounded): 0 DOF
                    // Cube_1_1_3 = 113 (top center): 1 DOF in +Z direction
                    // Cube_1_1_1 = 111 (bottom center): 1 DOF in -Z direction
                    // Cube_0_*_* = left side: 1 DOF in +X direction
                    // Cube_2_*_* = right side: 1 DOF in -X direction
                    // Cube_*_0_* = front side: 1 DOF in +Y direction
                    // Cube_*_2_* = back side: 1 DOF in -Y direction
                    
                    let outward;
                    let maxOffset;
                    
                    // Parse cube name to extract indices
                    const nameParts = obj.name.split('_');
                    let cubeX, cubeY, cubeZ;
                    
                    if (nameParts.length >= 4) {
                        cubeX = parseInt(nameParts[1]);
                        cubeY = parseInt(nameParts[2]);
                        cubeZ = parseInt(nameParts[3]);
                    } else {
                        cubeX = 1; cubeY = 1; cubeZ = 2; // Default to center
                    }
                    
                    // Classify by name
                    if (cubeX === 1 && cubeY === 1 && cubeZ === 2) {
                        // Center cube 112: grounded, no movement
                        outward = new THREE.Vector3(0, 0, 0);
                        maxOffset = 0;
                    } else if (cubeX === 1 && cubeY === 1 && cubeZ === 3) {
                        // Top cube 113: moves in +Z direction
                        outward = new THREE.Vector3(0, 0, 1);
                        maxOffset = 1.0;
                    } else if (cubeX === 1 && cubeY === 1 && cubeZ === 1) {
                        // Bottom cube 111: moves in -Z direction
                        outward = new THREE.Vector3(0, 0, -1);
                        maxOffset = 1.0;
                    } else if (cubeX === 1 && cubeY === 0) {
                        // Front center edge (103, 102, 101): locked
                        outward = new THREE.Vector3(0, 0, 0);
                        maxOffset = 0;
                    } else if (cubeX === 1 && cubeY === 2) {
                        // Back center edge (323, 322, 321): locked
                        outward = new THREE.Vector3(0, 0, 0);
                        maxOffset = 0;
                    } else if (cubeX === 0 && cubeY === 1) {
                        // Left center edge (013, 012, 011): locked
                        outward = new THREE.Vector3(0, 0, 0);
                        maxOffset = 0;
                    } else if (cubeX === 2 && cubeY === 1) {
                        // Right center edge (213, 212, 211): locked
                        outward = new THREE.Vector3(0, 0, 0);
                        maxOffset = 0;
                    } else if (cubeX === 0) {
                        // Left side (X=0): moves in +X direction
                        outward = new THREE.Vector3(1, 0, 0);
                        maxOffset = 2.0;
                    } else if (cubeX === 2) {
                        // Right side (X=2): moves in -X direction
                        outward = new THREE.Vector3(-1, 0, 0);
                        maxOffset = 2.0;
                    } else if (cubeX === 1 && cubeY === 0 && cubeZ === 3) {
                        // Front top cube 103: locked (no movement)
                        outward = new THREE.Vector3(0, 0, 0);
                        maxOffset = 0;
                    } else if (cubeY === 0) {
                        // Front side (Y=0): moves in +Y direction
                        outward = new THREE.Vector3(0, 1, 0);
                        maxOffset = 2.0;
                    } else if (cubeY === 2) {
                        // Back side (Y=2): moves in -Y direction
                        outward = new THREE.Vector3(0, -1, 0);
                        maxOffset = 2.0;
                    } else {
                        // Fallback
                        outward = new THREE.Vector3(1, 0, 0);
                        maxOffset = 0.1;
                    }
                    
                    // Compute layer for sorting (based on Z index for now)
                    const layer = cubeZ;
                    
                    // Compute angle for spiral sorting (based on X,Y position)
                    const angle = Math.atan2(cubeY - 1, cubeX - 1);
                    
                    cubeSpiralData.push({
                        mesh: obj,
                        geometry: geo,
                        originalPositions,
                        originalMeshPos: obj.position.clone(),  // Store the cube's original local position
                        cubeCenter: cubeCenterLocal,
                        outward,
                        layer,
                        angle,
                        maxOffset,  // Per-cube offset magnitude (0.25 for vertical, 0.1 for radial)
                        phaseIndex: 0
                    });
                });

                // Sort cubes: start from top-center, spiral outward
                // Top layer cubes first (sorted by radial distance: center → edges)
                // Then middle layers, then bottom
                cubeSpiralData.sort((a, b) => {
                    // Descending layer (top first)
                    if (a.layer !== b.layer) return b.layer - a.layer;
                    
                    // Within same layer: by radial distance (center first)
                    const aDist = a.cubeCenter.x * a.cubeCenter.x + a.cubeCenter.z * a.cubeCenter.z;
                    const bDist = b.cubeCenter.x * b.cubeCenter.x + b.cubeCenter.z * b.cubeCenter.z;
                    if (Math.abs(aDist - bDist) > 0.1) return aDist - bDist;
                    
                    // If same distance: by angle (CW spiral - opposite to lattice rotation)
                    return b.angle - a.angle;
                });

                // Assign phase indices for timing
                cubeSpiralData.forEach((c, i) => {
                    c.phaseIndex = i;
                });

                spiralReady = true;
                console.log('✓ Spiral data prepared. Cube count:', cubeSpiralData.length);
                console.log(`✓ Spiral pulse animation ready: ${PULSE_PERIOD}s period, 15% scale pulse`);

                // Load Marble03 BaseColor texture
                const textureLoader = new THREE.TextureLoader();

                const marbleBase = textureLoader.load(
                    'textures/Marble03_4K_BaseColor.png',
                    () => console.log('✓ BaseColor loaded')
                );

                // Configure texture tiling
                marbleBase.wrapS = THREE.RepeatWrapping;
                marbleBase.wrapT = THREE.RepeatWrapping;
                marbleBase.repeat.set(1.5, 1.5);
                marbleBase.magFilter = THREE.LinearFilter;
                marbleBase.minFilter = THREE.LinearMipMapLinearFilter;

                // Material with high contrast to show texture detail
                const marbleMaterial = new THREE.MeshStandardMaterial({
                    map: marbleBase,
                    roughness: 0.35,  // Slightly shiny to show texture
                    metalness: 0.1,   // Subtle reflections
                    side: THREE.DoubleSide
                });

                // Gold text material (PBR + emissive glow) - for future text meshes
                const goldTextMaterial = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0xffd700),          // gold base
                    emissive: new THREE.Color(0xffa000),       // warm glow
                    emissiveIntensity: 0.65,
                    metalness: 1.0,                            // full metal
                    roughness: 0.25                            // slight polish
                });

                // Generate UVs where missing, then apply marble
                let meshCount = 0;
                
                model.traverse((obj) => {
                    if (!obj.isMesh) return;

                    const geo = obj.geometry;

                    // Generate UVs if missing (Inventor GLB fix)
                    if (!geo.attributes.uv) {
                        generateUVsForCube(THREE, geo, obj.name);
                    }

                    // AO map requires a second UV set (reuse UVs)
                    if (!geo.attributes.uv2) {
                        geo.setAttribute('uv2', geo.attributes.uv);
                    }

                    const name = obj.name.toLowerCase();

                    // Gold text detection - applies to any "text" or "letter" meshes
                    if (name.includes("text") || name.includes("letter")) {
                        obj.material = goldTextMaterial;
                        console.log(`  ${obj.name} → GOLD TEXT`);
                        meshCount++;
                        obj.castShadow = true;
                        obj.receiveShadow = true;
                        return;
                    }

                    // Default: marble for all cubes
                    obj.material = marbleMaterial;
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                    meshCount++;
                });

                console.log('Total meshes:', meshCount);

                // Auto-fit camera (reuse center from spiral setup)
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                // center already declared in spiral setup, just reuse it
                
                console.log('Model size:', size);
                console.log('Model center:', center);

                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                const baseDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                const viewDistance = baseDistance * 2.9;
                
                camera.position.set(
                    center.x + viewDistance * 0.45,
                    center.y + viewDistance * 0.30,
                    center.z + viewDistance * 0.45
                );
                
                const lookTarget = center.clone();
                lookTarget.y -= maxDim * 0.08;
                camera.lookAt(lookTarget);
                
                controls.target.copy(center);
                controls.update();

                console.log('✓ Camera positioned');
                console.log('✓✓✓ VIEWER READY ✓✓✓\n');

                URL.revokeObjectURL(url);
            },
            (progress) => {
                if (progress.total) {
                    const pct = Math.round((progress.loaded / progress.total) * 100);
                    console.log('Loading:', pct + '%');
                } else {
                    console.log('Loading:', progress.loaded, 'bytes');
                }
            },
            (error) => {
                console.error('✗ Model load error:', error);
                container.innerHTML = '<div style="color: #f00; padding: 20px; font-family: monospace;">Error: ' + (error.message || error) + '</div>';
                URL.revokeObjectURL(url);
            }
        );

    } catch (error) {
        console.error('✗ ERROR:', error);
        container.innerHTML = '<div style="color: #f00; padding: 20px; font-family: monospace;">Error: ' + error.message + '</div>';
    }

    // Handle resize
    window.addEventListener('resize', () => {
        const nw = container.clientWidth || 800;
        const nh = container.clientHeight || 600;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });
})();
