let meca3 = require("meca3");
let THREE = require("three");

// INITIALIZATION OF 3D SCENE

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// The points in simulation are represented as spheres of different colors.
let geometry = new THREE.SphereGeometry(2);
let colors = [0xffff00, 0x00ffff]; //, 0xff00ff];
let materials = colors.map((color) => new THREE.MeshBasicMaterial({color: color}));
let spheres = materials.map((material) => new THREE.Mesh(geometry, material));
scene.add(...spheres);

// INITIALIZATION OF THE SIMULATION

let day = 86400; // day in s
let month = 2.628e+6; // month in s
let g = 6.67408e-11; // universal gravitation constant in SI

// The array bellow are ordered as [sun, earth]
let x = [0, 1.47098074e+11]; // initial x position in m
let vy = [0, 3.0287e+4]; // initial y speed in m/s
let mass = [1.9891e+30, 5.9736e+24];  // mass in kg
let speed = month; // simulation speed
let framerate = 60; // framerate of animation in frame/s
let delta = 1 / framerate; // time step of animation in s
let scale = 1e-10; // scaling factor to represent bodies in animation
let dt = delta / 2048; // time step = delta / number of samples per frame
let points = mass.map((m) => meca3.Point.zeros(m));
let u0 = x.map((s) => meca3.Vector3.ex.mul(s));
let v0 = vy.map((s) => meca3.Vector3.ey.mul(s));

// gravitational field between earth and sun
let makeField = (points) =>
    (u) => points.reduce((acc, point) =>
        acc.add(point.position.sub(u).mul(g * point.mass / (point.position.dist(u) ** 3 || Number.POSITIVE_INFINITY)))
    , meca3.Vector3.zeros);

let solver = new Solver(makeField(points), dt * speed);
let field = new meca3.Field(points, solver);
let time = 0;

// initializing each point with given position and speed
points.forEach((point, index) => point.init(u0[index], v0[index]));

camera.position.z = 75;

// SIMULATION LOOP

function animate() {

    // updating spheres position in sphere according to current position of points in field
    spheres.forEach((sphere, index) => {
        sphere.position.x = field.points[index].x * scale;
        sphere.position.y = field.points[index].y * scale;
        sphere.position.z = field.points[index].z * scale;
        console.log(`points[${index}](${Math.floor(time)}) = ${field.points[index].position.toString()}`);
    });

    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    // updating the position of the points in field
    for (let t = 0; t < delta; t += dt) {
        field.update();
    }
    time += (delta * speed) / day;
}

animate();