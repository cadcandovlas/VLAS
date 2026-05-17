// Global viewer with THREE, GLTFLoader, and OrbitControls loaded as globals
console.log('=== Viewer Global Script Loading ===');

// Wait for all scripts to load
function waitForScripts() {
    const checks = { THREE: false, GLTFLoader: false, OrbitControls: false };
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            checks.THREE = typeof THREE !== 'undefined' && THREE.REVISION;
            checks.GLTFLoader = typeof GLTFLoader !== 'undefined';
            checks.OrbitControls = typeof OrbitControls !== 'undefined';
            
            console.log('Script check:', checks);
            
            if (checks.THREE && checks.GLTFLoader && checks.OrbitControls) {
                clearInterval(checkInterval);
                console.log('✓ All scripts loaded');
                resolve();
            }
        }, 100);
        
        // Safety timeout
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!checks.THREE) console.warn('THREE not loaded');
            if (!checks.GLTFLoader) console.warn('GLTFLoader not loaded');
            if (!checks.OrbitControls) console.warn('OrbitControls not loaded');
            resolve();
        }, 10000);
    });
}

async function initViewer() {
    console.log('=== Initializing Viewer ===');
    
    // Wait for all libraries
    await waitForScripts();
    
    if (typeof THREE === 'undefined') {
        console.error('FATAL: THREE.js not available');
        return;
    }
    
    console.log('THREE version:', THREE.REVISION);
    console.log('GLTFLoader:', typeof GLTFLoader);
    console.log('OrbitControls:', typeof OrbitControls);

    const container = document.getElementById('viewer');
    if (!container) {
        console.error('ERROR: #viewer not found');
        return;
    }

    const w = container.clientWidth;
    const h = container.clientHeight;
    console.log('Viewer size:', w, 'x', h);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    console.log('✓ Scene created');

    // Camera setup
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100000);
    camera.position.set(100, 100, 100);
    console.log('✓ Camera created');

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, precision: 'highp' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    console.log('✓ Renderer created');

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    scene.add(dirLight);
    console.log('✓ Lights added');

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    console.log('✓ Controls created');

    // Model variable
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
    console.log('Model path:', modelPath);

    const loader = new GLTFLoader();
    
    loader.load(
        modelPath,
        (gltf) => {
            console.log('✓✓✓ MODEL LOADED ✓✓✓');
            model = gltf.scene;
            scene.add(model);

            // Analyze
            let meshCount = 0;
            let materialCount = 0;
            model.traverse((node) => {
                if (node.isMesh) {
                    meshCount++;
                    if (node.material) {
                        materialCount++;
                        console.log('  Mesh:', node.name, 'Material:', node.material.type || 'unknown');
                    }
                }
            });
            console.log('Total meshes:', meshCount);
            console.log('Total materials:', materialCount);

            // Fit camera
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log('Model center:', center);
            console.log('Model size:', size);

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            const distance = maxDim / (2 * Math.tan(fov / 2)) * 2.5;

            camera.position.copy(center);
            camera.position.z += distance;
            camera.lookAt(center);
            
            controls.target.copy(center);
            controls.dampingFactor = 0.05;
            controls.autoRotate = false;
            controls.update();

            console.log('✓ Camera positioned');
            console.log('✓✓✓ Model Ready ✓✓✓\n');
        },
        (progress) => {
            const pct = Math.round((progress.loaded / progress.total) * 100) || 0;
            console.log('Loading:', pct + '%', '(' + Math.round(progress.loaded / 1024 / 1024) + 'MB)');
        },
        (error) => {
            console.error('✗✗✗ MODEL LOAD FAILED ✗✗✗');
            console.error('Path:', modelPath);
            console.error('Error:', error);
            console.error('Message:', error?.message);
            
            const msg = `
                <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-family:monospace; color:#ff6b6b; font-size:12px; text-align:center; padding:20px;">
                    <div>
                        <strong>Failed to load model</strong><br/>
                        <br/>
                        Path: ${modelPath}<br/>
                        <br/>
                        Error: ${error?.message || String(error)}<br/>
                        <br/>
                        Check console (F12) for details
                    </div>
                </div>
            `;
            container.innerHTML = msg;
        }
    );

    // Handle resize
    window.addEventListener('resize', () => {
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });

    console.log('=== Viewer Initialization Complete ===\n');
}

// Start when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewer);
} else {
    initViewer();
}
