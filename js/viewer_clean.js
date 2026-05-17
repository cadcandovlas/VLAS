window.addEventListener("load", function () {

    console.log("VIEWER_CLEAN.JS IS RUNNING");

    const container = document.getElementById("viewer");
    if (!container) {
        console.error("Viewer container not found.");
        return;
    }

    function showError(message) {
        let errorDiv = document.getElementById("viewer-error");
        if (!errorDiv) {
            errorDiv = document.createElement("div");
            errorDiv.id = "viewer-error";
            container.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = "flex";
        errorDiv.style.justifyContent = "center";
        errorDiv.style.alignItems = "center";
        console.error(message);
    }

    try {
        // Get container dimensions
        let width = container.clientWidth || 600;
        let height = container.clientHeight || 400;
        
        console.log("Container dimensions:", width, "x", height);

        let scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        let camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            0.1,
            1000
        );
        camera.position.set(2, 2, 4);

        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        container.appendChild(renderer.domElement);
        
        console.log("Renderer created, canvas appended");

        let controls = new THREE.OrbitControls(camera, renderer.domElement);

        let light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        scene.add(light);

        // Add a test cube
        let geometry = new THREE.BoxGeometry(1, 1, 1);
        let material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        let cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        console.log("Cube added to scene");

        function animate() {
            requestAnimationFrame(animate);
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            renderer.render(scene, camera);
        }

        console.log("Starting animation loop");
        animate();
    } catch (error) {
        showError("Error initializing viewer:\n" + error.message);
    }

});
