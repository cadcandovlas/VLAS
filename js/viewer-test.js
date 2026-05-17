// Simple test to verify Three.js rendering works
import { OrbitControls } from './three.js-r146/examples/jsm/controls/OrbitControls.js';

console.log('=== Test Viewer Module Loaded ===');

function initTestViewer() {
    console.log('=== Testing THREE.js Rendering ===');
    
    const viewerContainer = document.getElementById('viewer');
    if (!viewerContainer) {
        console.error('ERROR: #viewer container not found!');
        return;
    }

    const width = viewerContainer.clientWidth;
    const height = viewerContainer.clientHeight;
    console.log('Container:', width, 'x', height);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(3, 3, 3);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    viewerContainer.innerHTML = '';
    viewerContainer.appendChild(renderer.domElement);
    console.log('✓ Renderer created');

    // Lights
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    console.log('✓ Lights added');

    // Test cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    console.log('✓ Test cube added');

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Render loop
    function animate() {
        requestAnimationFrame(animate);
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.005;
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    console.log('✓ Animation started - You should see a GREEN ROTATING CUBE');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTestViewer);
} else {
    setTimeout(initTestViewer, 100);
}
