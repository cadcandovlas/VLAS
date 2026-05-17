// Non-module version that relies on THREE being global
console.log('=== Simple Viewer Loading ===');

function initSimpleViewer() {
    console.log('Document ready:', document.readyState);
    console.log('THREE available:', typeof THREE);
    console.log('THREE version:', THREE?.REVISION);

    const container = document.getElementById('viewer');
    if (!container) {
        console.error('No #viewer element found');
        return;
    }

    const w = container.clientWidth;
    const h = container.clientHeight;
    console.log('Container size:', w, 'x', h);

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 10000);
    camera.position.set(0, 0, 5);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Add lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    // Show loading indicator
    const status = document.createElement('div');
    status.style.cssText = 'position:absolute; top:10px; left:10px; background:#222; color:#0f0; padding:10px; font-family:monospace; font-size:11px; z-index:100;';
    status.innerHTML = 'Loading model...';
    container.appendChild(status);

    // Create loader
    const loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@r146/examples/js/loaders/GLTFLoader.js';
    loaderScript.onload = () => {
        console.log('GLTFLoader script loaded');
        
        const orbitScript = document.createElement('script');
        orbitScript.src = 'https://cdn.jsdelivr.net/npm/three@r146/examples/js/controls/OrbitControls.js';
        orbitScript.onload = () => {
            console.log('OrbitControls script loaded');
            startViewer();
        };
        document.head.appendChild(orbitScript);
    };
    loaderScript.onerror = () => {
        console.error('Failed to load GLTFLoader from CDN');
        status.innerHTML = 'Error loading GLTFLoader';
    };
    document.head.appendChild(loaderScript);

    function startViewer() {
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        
        const gltfLoader = new THREE.GLTFLoader();
        const modelPath = 'models/VLAS_ASSEMBLY_MASTER_Blender.glb';
        
        console.log('Loading model:', modelPath);
        status.innerHTML = 'Loading ' + modelPath + '...';

        gltfLoader.load(
            modelPath,
            (gltf) => {
                console.log('Model loaded successfully!');
                const model = gltf.scene;
                scene.add(model);

                // Count meshes
                let meshCount = 0;
                model.traverse((node) => {
                    if (node.isMesh) meshCount++;
                });
                console.log('Mesh count:', meshCount);

                // Fit camera
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                camera.position.copy(center);
                camera.position.z += maxDim;
                camera.lookAt(center);
                controls.target.copy(center);
                controls.update();

                status.innerHTML = 'Model loaded (' + meshCount + ' meshes)';
                status.style.color = '#0f0';
            },
            (progress) => {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                console.log('Loading:', pct + '%');
                status.innerHTML = 'Loading: ' + pct + '%';
            },
            (error) => {
                console.error('Model load error:', error);
                status.innerHTML = 'Error: ' + (error.message || error);
                status.style.color = '#f00';
            }
        );

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // Handle resize
        window.addEventListener('resize', () => {
            const nw = container.clientWidth;
            const nh = container.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        });

        console.log('Viewer started');
    }
}

// Start when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimpleViewer);
} else {
    initSimpleViewer();
}
