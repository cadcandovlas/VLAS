console.log('=== Loader Init Starting ===');

// Create a map to track loaded modules
const modules = {};

// Wait for THREE
function waitForTHREE() {
    return new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
            if (typeof window.THREE !== 'undefined' && window.THREE.REVISION) {
                console.log('✓ THREE loaded, version:', window.THREE.REVISION);
                resolve(window.THREE);
            } else if (attempts++ < 100) {
                setTimeout(check, 50);
            } else {
                console.error('THREE failed to load');
                resolve(undefined);
            }
        };
        check();
    });
}

// Load a script dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log('✓ Loaded:', src);
            resolve();
        };
        script.onerror = () => {
            console.error('✗ Failed to load:', src);
            reject(new Error('Failed to load ' + src));
        };
        document.head.appendChild(script);
    });
}

// Create minimal GLTFLoader wrapper if not available
function createGLTFLoaderIfNeeded() {
    if (typeof GLTFLoader !== 'undefined') {
        console.log('✓ GLTFLoader available');
        return;
    }
    
    console.log('Creating GLTFLoader wrapper...');
    
    // This is a fallback - the actual loader will be loaded from the ES6 module
    // by creating a special environment for it
}

// Main initialization
(async () => {
    try {
        console.log('Step 1: Wait for THREE.js...');
        const THREE = await waitForTHREE();
        
        if (!THREE) {
            throw new Error('THREE.js not loaded');
        }

        console.log('Step 2: Loading modules from three.js-r146...');
        
        // Create a custom environment for loading the ES6 modules
        // by pre-defining what they'll need
        window.THREE_MODULE = {
            Animation: {},
            Bone: THREE.Bone,
            Box3: THREE.Box3,
            BufferAttribute: THREE.BufferAttribute,
            BufferGeometry: THREE.BufferGeometry,
            // ... and hundreds of other THREE exports
        };
        
        // Actually, let's use a simpler approach: load the files as text and evaluate them
        console.log('Loading GLTFLoader source...');
        const gltfResponse = await fetch('./js/three.js-r146/examples/jsm/loaders/GLTFLoader.js');
        const gltfSource = await gltfResponse.text();
        
        console.log('Loading OrbitControls source...');
        const orbitResponse = await fetch('./js/three.js-r146/examples/jsm/controls/OrbitControls.js');
        const orbitSource = await orbitResponse.text();
        
        console.log('✓ Sources loaded');
        
        // Create a module system manually
        const myModules = {};
        
        // Define what 'three' module exports
        myModules['three'] = {
            __esModule: true,
            default: THREE,
            ...THREE
        };
        
        // Function to execute a module
        function evalModule(name, code, deps = {}) {
            const require = (id) => {
                console.log('Requiring:', id);
                if (deps[id]) return deps[id];
                if (myModules[id]) return myModules[id];
                throw new Error('Module not found: ' + id);
            };
            
            const module = { exports: {} };
            const exports = module.exports;
            
            // Wrap the code to replace import/export
            let wrapped = code
                .replace(/export\s*\{([^}]+)\}/g, (match, content) => {
                    const items = content.split(',').map(s => s.trim());
                    items.forEach(item => {
                        const [name, alias] = item.includes(' as ') 
                            ? item.split(' as ').map(s => s.trim())
                            : [item, item];
                        wrapped = 'module.exports.' + alias + ' = ' + name + ';\n' + wrapped;
                    });
                    return '';
                })
                .replace(/export\s+(class|function|const|let|var)\s+(\w+)/g, (match, type, name) => {
                    return type + ' ' + name + ';\nmodule.exports.' + name + ' = ' + name + ';\n' + match.replace('export ', '');
                })
                .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2");')
                .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, 'const {$1} = require("$2");')
                .replace(/import\s+(['"]([^'"]+)['"])/g, 'require($1)');
            
            try {
                const fn = new Function('require', 'module', 'exports', wrapped);
                fn(require, module, exports);
                return module.exports;
            } catch (e) {
                console.error('Error in module:', e);
                throw e;
            }
        }
        
        // Try to eval the modules
        console.log('Evaluating GLTFLoader...');
        const GLTFLoaderModule = evalModule('GLTFLoader', gltfSource);
        window.GLTFLoader = GLTFLoaderModule.GLTFLoader;
        
        console.log('Evaluating OrbitControls...');
        const OrbitControlsModule = evalModule('OrbitControls', orbitSource);
        window.OrbitControls = OrbitControlsModule.OrbitControls;
        
        console.log('✓ Modules ready');
        console.log('  GLTFLoader:', typeof window.GLTFLoader);
        console.log('  OrbitControls:', typeof window.OrbitControls);
        
        // Now load the viewer
        console.log('Loading viewer...');
        const viewerScript = document.createElement('script');
        viewerScript.src = './js/viewer-ready.js';
        document.head.appendChild(viewerScript);
        
    } catch (error) {
        console.error('INIT ERROR:', error);
        console.error('Stack:', error.stack);
    }
})();
