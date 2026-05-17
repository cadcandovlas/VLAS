// Proper ES6 module viewer using local three.js r146 files
console.log('=== Viewer Module Loading ===');

// Dynamic imports to ensure proper loading
(async () => {
    try {
        // Import loaders from local three.js r146
        const GLTFLoaderModule = await import('./three.js-r146/examples/jsm/loaders/GLTFLoader.js');
        const OrbitControlsModule = await import('./three.js-r146/examples/jsm/controls/OrbitControls.js');
        
        const GLTFLoader = GLTFLoaderModule.GLTFLoader;
        const OrbitControls = OrbitControlsModule.OrbitControls;
        
        console.log('✓ Modules imported');
        console.log('  - GLTFLoader:', typeof GLTFLoader);
        console.log('  - OrbitControls:', typeof OrbitControls);
        console.log('  - THREE:', typeof THREE);

        // Initialize viewer
        function init() {
            console.log('\n=== Initializing Viewer ===');
            
            const container = document.getElementById('viewer');
            if (!container) {
                console.error('ERROR: #viewer container not found');
                return;
            }

            const width = container.clientWidth;
            const height = container.clientHeight;
            console.log('Container size:', width, 'x', height);

            // Scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);
            console.log('✓ Scene created');

            // Camera
            const camera = new THREE.PerspectiveCamera(
                60,
                width / height,
                0.1,
                100000
            );
            camera.position.set(500, 500, 500);
            console.log('✓ Camera created');

            // Renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                precision: 'highp',
                powerPreference: 'high-performance'
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFShadowShadowMap;
            container.innerHTML = '';
            container.appendChild(renderer.domElement);
            console.log('✓ Renderer created and attached');

            // Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
            scene.add(ambientLight);
            console.log('✓ Ambient light added');

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
            directionalLight.position.set(200, 300, 200);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.left = -500;
            directionalLight.shadow.camera.right = 500;
            directionalLight.shadow.camera.top = 500;
            directionalLight.shadow.camera.bottom = -500;
            directionalLight.shadow.camera.near = 0.1;
            directionalLight.shadow.camera.far = 2000;
            scene.add(directionalLight);
            console.log('✓ Directional light added');

            // Controls
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.autoRotate = false;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.autoRotateSpeed = 2;
            console.log('✓ Orbit controls created');

            // Model storage
            let model = null;

            // Animation loop
            function animate() {
                requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            }
            animate();
            console.log('✓ Animation loop started');

            // Load model
            console.log('\n=== Loading Model ===');
            const modelPath = 'models/VLAS_ASSEMBLY_MASTER_Blender.glb';
            console.log('Loading from:', modelPath);

            const loader = new GLTFLoader();

            loader.load(
                modelPath,
                (gltf) => {
                    console.log('✓✓✓ MODEL LOADED SUCCESSFULLY ✓✓✓');
                    
                    model = gltf.scene;
                    scene.add(model);
                    console.log('✓ Model added to scene');

                    // Analyze model
                    let meshCount = 0;
                    let geometryCount = 0;
                    let materialCount = 0;

                    model.traverse((node) => {
                        if (node.isMesh) {
                            meshCount++;
                            if (node.geometry) geometryCount++;
                            if (node.material) materialCount++;
                            console.log('  - Mesh:', node.name);
                        }
                    });

                    console.log('Summary:');
                    console.log('  - Mesh count:', meshCount);
                    console.log('  - Geometry count:', geometryCount);
                    console.log('  - Material count:', materialCount);

                    // Compute bounding box and fit camera
                    const bbox = new THREE.Box3().setFromObject(model);
                    const center = bbox.getCenter(new THREE.Vector3());
                    const size = bbox.getSize(new THREE.Vector3());

                    console.log('Model info:');
                    console.log('  - Center:', center);
                    console.log('  - Size:', size);

                    // Calculate camera distance
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const fov = camera.fov * (Math.PI / 180);
                    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                    cameraDistance *= 2.5; // Add extra space

                    camera.position.copy(center);
                    camera.position.z += cameraDistance;
                    camera.lookAt(center);

                    controls.target.copy(center);
                    controls.update();

                    console.log('✓ Camera positioned to view entire model');
                    console.log('\n✓✓✓ VIEWER READY ✓✓✓\n');
                },
                (progress) => {
                    const loaded = Math.round(progress.loaded / 1024 / 1024);
                    const total = Math.round(progress.total / 1024 / 1024);
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    console.log(`Loading progress: ${percent}% (${loaded}MB / ${total}MB)`);
                },
                (error) => {
                    console.error('✗✗✗ ERROR LOADING MODEL ✗✗✗');
                    console.error('Path:', modelPath);
                    console.error('Error:', error);

                    let errorMsg = error?.message || String(error);
                    console.error('Details:', errorMsg);

                    // Show error in viewer
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: #000;
                        color: #f00;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: monospace;
                        font-size: 12px;
                        padding: 20px;
                        box-sizing: border-box;
                        text-align: center;
                        z-index: 1000;
                    `;
                    errorDiv.innerHTML = `
                        <div>
                            <strong>Failed to load 3D model</strong><br/><br/>
                            Path: ${modelPath}<br/>
                            Error: ${errorMsg}<br/><br/>
                            Check console (F12) for details
                        </div>
                    `;
                    container.appendChild(errorDiv);
                }
            );

            // Handle window resize
            window.addEventListener('resize', () => {
                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;

                camera.aspect = newWidth / newHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(newWidth, newHeight);
            });

            console.log('=== Viewer Init Complete ===\n');
        }

        // Start when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

    } catch (error) {
        console.error('FATAL ERROR:', error);
        console.error('Stack:', error.stack);
    }
})();
