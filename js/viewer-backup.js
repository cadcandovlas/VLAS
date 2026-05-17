// Clean 3D Rubik Cube Viewer - Fresh Start
console.log('=== CLEAN VIEWER STARTING ===');

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

        // After 90-degree X rotation: Z becomes visual vertical, Y becomes visual depth
        // Project onto the rotated orientation
        const ax = Math.abs(x);
        const az = Math.abs(z);  // This is now the dominant vertical after rotation
        const ay = Math.abs(y);

        // Prioritize Z (now vertical) and X (horizontal) for main faces
        if (az >= ax && az >= ay) {
            // Top/bottom (largest Z component) → map X/Y
            uv.push(
                (x - bbox.min.x) / (size.x || 1),
                (y - bbox.min.y) / (size.y || 1)
            );
        } else if (ax >= ay) {
            // Left/right (largest X) → map Z/Y  
            uv.push(
                (z - bbox.min.z) / (size.z || 1),
                (y - bbox.min.y) / (size.y || 1)
            );
        } else {
            // Front/back (largest Y) → map X/Z
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
let textMeshData = [];  // Store text meshes for synchronized emissive animation
let spiralReady = false;
let lastTime = 0;
let pulseDebugCounter = 0;
let pulseFirstRun = true;

// Motion constants
const PULSE_AMPLITUDE = 3.0;     // 3.0m extension (scale-based pulse works!)
const PULSE_PERIOD   = 4.0;      // seconds for a full pulse cycle
const ROTATION_SPEED = 0.25;     // lattice rotation speed (CW) - reduced by half
const MAX_TEXT_EMISSIVE = 1.0;  // Maximum emissive intensity for text at full pulse


    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        const now = performance.now() * 0.001; // seconds
        const delta = lastTime ? (now - lastTime) : 0;
        lastTime = now;

        // Lattice rotation (CW when viewed from above)
        if (model) {
            model.rotation.z += ROTATION_SPEED * delta;
        }

        // Spiral Pulse animation (CCW spiral with phase offsets)
        if (spiralReady && cubeSpiralData.length > 0) {
            const totalCubes = cubeSpiralData.length;
            const perCubeDelay = PULSE_PERIOD / totalCubes;

            let maxPulseAmount = 0; // Track max pulse for text emissive
            let animatedCount = 0;
            let movedCubes = [];
            let cubeMovementDeltas = {}; // Track actual movement per cube this frame

            for (const c of cubeSpiralData) {
                const container = c.container;
                const cubeName = container.name.match(/Cube_\d_\d_\d/)[0];

                // Time offset for this cube in the spiral
                const localTime = now - c.phaseIndex * perCubeDelay;
                
                // All cubes pulse with their phase offset (creates CCW spiral)
                const t = ((localTime % PULSE_PERIOD) + PULSE_PERIOD) % PULSE_PERIOD;
                const phase = t / PULSE_PERIOD; // 0..1

                // Smooth extend/retract using sine (0 → 1 → 0)
                const s = Math.sin(phase * Math.PI); // 0..1..0
                
                // Pulse amplitude - all cubes pulse (no layer gating)
                const pulseAmount = s;
                
                // Track maximum pulse for text glow synchronization
                if (pulseAmount > maxPulseAmount) {
                    maxPulseAmount = pulseAmount;
                }
                
                const scaleAmount = 1.0 + (pulseAmount * 0.15);
                
                // All cubes with DOF move in their DOF direction
                if (c.maxOffset > 0) {
                    animatedCount++;
                    // Has DOF: scale and move in DOF direction
                    const scaleX = Math.abs(c.outward.x) > 0.5 ? scaleAmount : 1.0;
                    const scaleY = Math.abs(c.outward.y) > 0.5 ? scaleAmount : 1.0;
                    const scaleZ = Math.abs(c.outward.z) > 0.5 ? scaleAmount : 1.0;
                    container.scale.set(scaleX, scaleY, scaleZ);
                    
                    // Position: move in DOF direction (outward during pulse)
                    const offset = pulseAmount * c.maxOffset;
                    const posOffset = c.outward.clone().multiplyScalar(offset);
                    const newPos = {
                        x: c.originalPosition.x + posOffset.x,
                        y: c.originalPosition.y + posOffset.y,
                        z: c.originalPosition.z + posOffset.z
                    };
                    container.position.x = newPos.x;
                    container.position.y = newPos.y;
                    container.position.z = newPos.z;
                    
                    // Track movement
                    const delta = Math.hypot(newPos.x - c.originalPosition.x, 
                                              newPos.y - c.originalPosition.y,
                                              newPos.z - c.originalPosition.z);
                    cubeMovementDeltas[cubeName] = delta;
                    
                    if (pulseAmount > 0.01) {
                        movedCubes.push(cubeName);
                    }
                } else {
                    // Center cube (no DOF): stationary
                    container.scale.set(1.0, 1.0, 1.0);
                    container.position.copy(c.originalPosition);
                }
            }

            // Update text emissive intensity based on pulse
            for (const textData of textMeshData) {
                textData.mesh.material.emissiveIntensity = maxPulseAmount * MAX_TEXT_EMISSIVE;
            }
            
            // Store animation debug data
            window.__animationFrames = (window.__animationFrames || 0) + 1;
            window.__lastAnimatedCount = animatedCount;
            window.__lastMovedCubes = movedCubes;
            window.__lastPulseAmount = maxPulseAmount;
            window.__lastMovementDeltas = cubeMovementDeltas;
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    console.log('✓ Animation loop started');

    // Load model
    console.log('\n=== Loading Model ===');
    const modelPath = 'models/VLAS_ASSEMBLY_MASTER_FREECAD.glb';
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

                // Correct 90-degree rotation
                model.rotation.x = Math.PI / 2;

                // --- Spiral Pulse: collect cube data and build spiral order ---

                // Compute overall center in WORLD space initially, then convert
                const bbox = new THREE.Box3().setFromObject(model);
                const center = bbox.getCenter(new THREE.Vector3());

                // Debug: Show model structure
                console.log('\n=== MODEL STRUCTURE DEBUG ===');
                let cubeObjectNames = [];
                let cameraLightNames = [];
                let otherNames = [];
                
                model.children.forEach(obj => {
                    if (obj.name.startsWith('Cube_')) {
                        cubeObjectNames.push({ name: obj.name, isGroup: !obj.isMesh, type: obj.type });
                    } else if (obj.name.startsWith('Camera') || obj.name.startsWith('Light')) {
                        cameraLightNames.push({ name: obj.name, isGroup: !obj.isMesh, type: obj.type });
                    } else {
                        otherNames.push({ name: obj.name, isGroup: !obj.isMesh, type: obj.type });
                    }
                });
                
                console.log('Cube objects at root:', cubeObjectNames.slice(0, 5));
                console.log('Camera/Light objects:', cameraLightNames);
                console.log('Other root objects (first 10):', otherNames.slice(0, 10));
                console.log('All root object names:', model.children.map(o => o.name).slice(0, 30));

            // === CLEAN CUBE DISCOVERY ===
            const cubeMap = new Map();  // baseName -> { meshes: [], position3D: [x,y,z], ... }
            
            // Walk through ALL objects in model
            model.traverse((obj) => {
                if (obj.isMesh && obj.name.startsWith('Cube_')) {
                    // Extract base name: Cube_X_Y_Z from names like Cube_1_1_0XX or Cube_1_1_001_17
                    const match = obj.name.match(/^Cube_(\d)_(\d)_(\d)/);
                    if (match) {
                        const baseName = `Cube_${match[1]}_${match[2]}_${match[3]}`;
                            
                        const cubeX = parseInt(match[1]);
                        const cubeY = parseInt(match[2]);
                        const cubeZ = parseInt(match[3]);
                        
                        if (!cubeMap.has(baseName)) {
                            cubeMap.set(baseName, {
                                meshes: [],
                                indices: { x: cubeX, y: cubeY, z: cubeZ },
                                container: null
                            });
                        }
                        
                        const entry = cubeMap.get(baseName);
                        entry.meshes.push(obj);
                        if (!entry.container) {
                            entry.container = obj.parent;  // Parent group
                        }
                    }
                }
            });

            console.log(`✓ Found ${cubeMap.size} unique cubes`);

            // === CALCULATE POSITIONS GEOMETRICALLY ===
            const SPACING = 0.1;  // Distance between cube centers
            const cubes = [];
            
            cubeMap.forEach((data, baseName) => {
                const { x, y, z } = data.indices;
                
                // Calculate world position based on 3x3x3 grid
                const posX = (x - 1) * SPACING;
                const posY = (y - 1) * SPACING;
                const posZ = (z - 1) * SPACING;
                
                // Determine DOF based on position
                let dof = { x: 0, y: 0, z: 0 };
                let maxOffset = 0.05;
                
                // Center cube stays frozen
                if (x === 1 && y === 1 && z === 1) {
                    maxOffset = 0;
                }
                // Z-faces (front=3, back=0)
                else if (x === 1 && y === 1) {
                    dof.z = z === 3 ? 1 : -1;
                }
                // Y-faces (top=2, bottom=0)
                else if (x === 1 && z === 1) {
                    dof.y = y === 2 ? 1 : -1;
                }
                // X-faces (right=2, left=0)
                else if (y === 1 && z === 1) {
                    dof.x = x === 2 ? 1 : -1;
                }
                // Edges and corners: move radially outward
                else {
                    if (x !== 1) dof.x = x === 2 ? 1 : -1;
                    if (y !== 1) dof.y = y === 2 ? 1 : -1;
                    if (z !== 1) dof.z = z === 3 ? 1 : -1;
                }
                
                cubes.push({
                    baseName,
                    meshes: data.meshes,
                    position: new THREE.Vector3(posX, posY, posZ),
                    dof,
                    maxOffset,
                    phaseIndex: 0
                });
                
                console.log(`  ${baseName}: pos(${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)}) DOF:${dof.x}${dof.y}${dof.z}`);
            });
            // === APPLY MATERIALS ===
            let textureLoaded = false;
            const textureLoader = new THREE.TextureLoader();
            
            textureLoader.load('textures/Marble03_4K_BaseColor.png', (texture) => {
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearMipMapLinearFilter;
                
                cubes.forEach((cube) => {
                    cube.meshes.forEach((mesh) => {
                        const geometry = mesh.geometry;
                        
                        if (!geometry.attributes.uv) {
                            generateUVsForCube(THREE, geometry, mesh.name);
                        }
                        
                        const material = new THREE.MeshStandardMaterial({
                            map: texture,
                            roughness: 0.35,
                            metalness: 0.1,
                            side: THREE.DoubleSide
                        });
                        
                        mesh.material = material;
                    });
                });
                
                textureLoaded = true;
                console.log('✓ Marble texture applied');
            });

            // === ANIMATION ===
            const ROTATION_SPEED = 0.3;  // rad/s
            const PULSE_PERIOD = 4;  // seconds

            let time = 0;
            const animate = () => {
                requestAnimationFrame(animate);
                const delta = 1 / 60;  // Assume 60 FPS
                time += delta;

                // Rotate entire model (CW when viewed from above = +Z)
                model.rotation.z += ROTATION_SPEED * delta;

                // Spiral pulse animation
                cubes.forEach((cube, idx) => {
                    const phaseOffset = (idx / cubes.length) * PULSE_PERIOD;
                    const t = (time - phaseOffset) % PULSE_PERIOD;
                    const pulse = 0.15;  // 15% scale pulse
                    const scale = 1 + pulse * Math.sin((t / PULSE_PERIOD) * Math.PI * 2);
                    
                    // Radial movement along DOF direction
                    const offset = Math.sin((t / PULSE_PERIOD) * Math.PI * 2) * cube.maxOffset;
                    
                    const targetPos = cube.position.clone().addScaledVector(
                        new THREE.Vector3(cube.dof.x, cube.dof.y, cube.dof.z).normalize(),
                        offset
                    );
                    
                    cube.meshes.forEach((mesh) => {
                        mesh.position.lerp(targetPos, 0.1);
                        mesh.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
                    });
                });

                renderer.render(scene, camera);
            };

            animate();
            console.log('✓✓✓ VIEWER READY ✓✓✓\n');

        },
        undefined,
        (error) => {
            console.error('✗ Failed to load model:', error);
        }
    );

})();

    // Handle resize
    window.addEventListener('resize', () => {
        const nw = container.clientWidth || 800;
        const nh = container.clientHeight || 600;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });
})();
