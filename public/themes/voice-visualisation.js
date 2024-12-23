// Set up scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let mainShapeStrength = 0.3;
let wireframeShapeStrength = 0.7;
let shapeSpeed = 1;

// Custom Shader Material for rainbow effect
const vertexShader = `
    varying vec3 vPosition;
    void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    varying vec3 vPosition;
    uniform float time;
    void main() {
        float intensity = length(vPosition) * 0.5;
        vec3 color = vec3(
            0.00 + 0.00 * sin(intensity * 5.0 + time), // Слабый красный компонент
            0.40 + 0.20 * sin(intensity * 10.0 + time + 1.0), // Средний зелёный компонент (голубизна)
            0.80 + 0.20 * sin(intensity * 6.0 + time + 3.0)  // Сильный синий компонент
        );
        gl_FragColor = vec4(color, 0.2); // Прозрачность
    }
`;


const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        time: { value: 0.0 },
    },
    wireframe: false,
    transparent: true,
    blending: THREE.AdditiveBlending, // Сложение цветов для свечения
    depthWrite: false,
});

// Particle Sphere
const particleCount = 2000;
const maxRadius = 4.5;
const minRadius = 4;

const particles = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const biasedPhi = phi * 0.6 + (Math.random() < 0.5 ? 0 : Math.PI * 0.4);
    const radius = Math.random() * (maxRadius - minRadius) + minRadius;

    positions[i * 3] = radius * Math.sin(biasedPhi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(biasedPhi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(biasedPhi);

    velocities[i * 3] = (Math.random() - 0.5) * 0.01;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
}

function updateParticles(){
    for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        const biasedPhi = phi * 0.6 + (Math.random() < 0.5 ? 0 : Math.PI * 0.4);
        const radius = Math.random() * (maxRadius - minRadius) + minRadius;

        positions[i * 3] = radius * Math.sin(biasedPhi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(biasedPhi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(biasedPhi);

        velocities[i * 3] = (Math.random() - 0.5) * shapeSpeed;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * shapeSpeed;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * shapeSpeed;
    }
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

const particleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03 });
const pointCloud = new THREE.Points(particles, particleMaterial);
scene.add(pointCloud);

// Changing Mesh Sphere
const meshGeometry = new THREE.SphereGeometry(3, 64, 64);
const meshWireFrameGeometry = new THREE.SphereGeometry(3, 16, 16);
const meshMaterial = new THREE.MeshBasicMaterial({
    color: 0x141414,
    wireframe: true,
});
const changingMesh = new THREE.Mesh(meshGeometry, shaderMaterial);
const changingWireFrameMesh = new THREE.Mesh(meshWireFrameGeometry, meshMaterial);
scene.add(changingMesh);
scene.add(changingWireFrameMesh);

// Camera position
camera.position.z = 10;
camera.position.y = -1.5;

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update particles
    const positions = particles.attributes.position.array;
    const velocities = particles.attributes.velocity.array;

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i * 3] * shapeSpeed;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * shapeSpeed;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * shapeSpeed;

        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        const distance = Math.sqrt(x * x + y * y + z * z);

        if (distance > maxRadius || distance < minRadius) {
            velocities[i * 3] *= -1;
            velocities[i * 3 + 1] *= -1;
            velocities[i * 3 + 2] *= -1;
        }
    }

    particles.attributes.position.needsUpdate = true;

    // Update mesh vertices dynamically
    meshGeometry.vertices.forEach((vertex) => {
        vertex.normalize().multiplyScalar(4 + Math.sin(Date.now() * 0.002 + vertex.x * 5) * mainShapeStrength);
    });
    meshGeometry.verticesNeedUpdate = true;

    meshWireFrameGeometry.vertices.forEach((vertex) => {
        vertex.normalize().multiplyScalar(4 + Math.sin(Date.now() * 0.002 + 0.001 + vertex.x * 5) * wireframeShapeStrength);
    });
    meshWireFrameGeometry.verticesNeedUpdate = true;

    // Rotate objects
    pointCloud.rotation.x += 0.001;
    pointCloud.rotation.y += 0.002;

    changingMesh.rotation.x += 0.002;
    changingMesh.rotation.y += 0.003;

    changingWireFrameMesh.rotation.x += 0.002;
    changingWireFrameMesh.rotation.y += 0.003;

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
