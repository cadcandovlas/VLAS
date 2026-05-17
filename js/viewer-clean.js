// Clean 3D Rubik Cube Viewer - Fresh Start
console.log('=== CLEAN VIEWER STARTING ===');

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

function waitForDOM() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

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

        const ax = Math.abs(x);
        const az = Math.abs(z);
        const ay = Math.abs(y);

        if (az >= ax && az >= ay) {
            uv.push(
                (x - bbox.min.x) / (size.x || 1),
                (y - bbox.min.y) / (size.y || 1)
            );
        } else if (ax >= ay) {
            uv.push(
                (z - bbox.min.z) / (size.z || 1),
                (y - bbox.min.y) / (size.y || 1)
            );
        } else {
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

(async () => {
    await waitForDOM();
    const THREE = await waitForTHREE();
    
    const container = document.getElementById('viewer');
    if (!container) {
        console.error('✗ No viewer container');
        return;
    }

    const W = container.clientWidth || 800;
    const H = container.clientHeight || 600;
    console.log(`Container: ${W}x${H}`);

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0.3, 0.3, 0.3);
    camera.lookAt(0, 0, 0);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(renderer.domElement);
    console.log('✓ Renderer created');

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    console.log('✓ Lights added');

    // Load model
    console.log('Loading model: models/VLAS_ASSEMBLY_MASTER_FREECAD.glb');
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        'models/VLAS_ASSEMBLY_MASTER_FREECAD.glb',
        (gltf) => {
            const model = gltf.scene;
            scene.add(model);
            
            // Apply rotation fix
            model.rotation.x = Math.PI / 2;  // Fix 90° tilt
            
            console.log('✓ Model loaded');

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
