console.log('=== Simple Working Viewer ===');

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

    const W = container.clientWidth;
    const H = container.clientHeight;
    console.log('Container size:', W, 'x', H);

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100000);
    camera.position.set(200, 200, 200);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    console.log('✓ Renderer ready');

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(100, 150, 100);
    scene.add(dirLight);
    console.log('✓ Lights added');

    let model = null;

    // Animation loop with OrbitControls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    console.log('✓ OrbitControls ready');

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    console.log('✓ Animation started');

    // Load model using fetch and GLB parsing
    console.log('\n=== Loading Model ===');
    const modelPath = 'models/VLAS_ASSEMBLY_MASTER_Blender.glb';
    
    try {
        console.log('Fetching:', modelPath);
        const response = await fetch(modelPath);
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        console.log('Response size:', response.headers.get('content-length'), 'bytes');
        const arrayBuffer = await response.arrayBuffer();
        console.log('Downloaded:', arrayBuffer.byteLength, 'bytes');

        // Try to find and load GLTFLoader
        let loader = null;

        // Check if GLTFLoader exists globally (loaded by script tag)
        if (typeof THREE.GLTFLoader !== 'undefined') {
            console.log('✓ Using THREE.GLTFLoader');
            loader = new THREE.GLTFLoader();
        } else if (typeof GLTFLoader !== 'undefined') {
            console.log('✓ Using global GLTFLoader');
            loader = new GLTFLoader();
        } else {
            console.error('✗ GLTFLoader not found in THREE or global scope');
            throw new Error('GLTFLoader not available');
        }

        // Create a blob URL from the buffer
        const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        console.log('Created blob URL:', url);

        // Load the model
        loader.load(
            url,
            (gltf) => {
                console.log('✓✓✓ MODEL LOADED ✓✓✓');
                model = gltf.scene;
                scene.add(model);

                // Analyze
                let meshes = 0;
                model.traverse((obj) => {
                    if (obj.isMesh) {
                        meshes++;
                        console.log('  Mesh:', obj.name);
                    }
                });
                console.log('Total meshes:', meshes);

                // Fit camera
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                console.log('Model size:', size);

                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                const distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.5;

                camera.position.copy(center);
                camera.position.z += distance;
                camera.lookAt(center);

                // Important: set controls target to model center
                controls.target.copy(center);
                controls.update();

                console.log('✓ Camera positioned');
                console.log('✓✓✓ READY ✓✓✓\n');

                URL.revokeObjectURL(url);
            },
            (progress) => {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                console.log('Loading:', pct + '%');
            },
            (error) => {
                console.error('✗ Load error:', error);
                container.innerHTML = '<div style="color: #f00; padding: 20px; font-family: monospace;">Error: ' + (error.message || error) + '</div>';
                URL.revokeObjectURL(url);
            }
        );

    } catch (error) {
        console.error('✗ FETCH ERROR:', error);
        console.error('Stack:', error.stack);
        container.innerHTML = '<div style="color: #f00; padding: 20px; font-family: monospace;">Error: ' + error.message + '</div>';
    }

    // Handle resize
    window.addEventListener('resize', () => {
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });
})();
