import { Field, Point } from "meca3";
import { BasicCurve, BufferCurve, Vector3 } from "space3";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const BUFFER_LENGTH = 4096;
const SAMPLE_PER_FRAMES = 8192;
const TARGET_FRAMERATE = 60;
const BODY_COLORS = [0xffff00, 0x00ffff];

const SECS_PER_DAY = 86400;
const SECS_PER_MONTH = 2.628e6;
const GRAVITATIONAL_CONSTANT = 6.67408e-11; // universal gravitation constant in SI

let speed = SECS_PER_MONTH; // simulation speed
let delta = 1 / TARGET_FRAMERATE; // time step of animation in s
let scale = 1e-10; // scaling factor to represent bodies in animation
let dt = delta / SAMPLE_PER_FRAMES; // time step = delta / number of samples per frame
let time = 0; // time elapsed in days

function initSimulation() {
  const points = [
    new Point(1.9891e30), // sun
    new Point(
      5.9736e24,
      Vector3.ex.mul(1.47098074e11),
      Vector3.ey.mul(3.0287e4)
    ), // earth
  ];

  const trajectories = points.map((p) =>
    BufferCurve.bufferize(BasicCurve.constant(BUFFER_LENGTH, p.position))
  );

  // gravitational field between earth and sun
  const gravitationalAcceleration = (acceleration, position) => {
    return points.reduce((acc, point) => {
      const dist3 =
        point.position.dist(position) ** 3 || Number.POSITIVE_INFINITY;
      const k = (GRAVITATIONAL_CONSTANT * point.mass) / dist3;
      return acc.add(point.position.sub(position).mul(k));
    }, acceleration);
  };

  const field = new Field(points, gravitationalAcceleration, dt * speed);

  return { field, trajectories };
}

function initObjectSpheres(points) {
  // The points in simulation are represented as spheres of different colors.
  const geometry = new THREE.SphereGeometry(2);
  const materials = points.map(
    (_, idx) => new THREE.MeshBasicMaterial({ color: BODY_COLORS[idx] })
  );
  return materials.map((material) => new THREE.Mesh(geometry, material));
}

function initObjectLines(trajectories) {
  const geometries = trajectories.map((trajectory) => {
    const geometry = new THREE.Geometry();
    geometry.vertices = trajectory.positions.map(
      (p) => new THREE.Vector3(p.x * scale, p.y * scale, p.z * scale)
    );
    return geometry;
  });
  const materials = trajectories.map(
    (_, idx) =>
      new THREE.LineDashedMaterial({
        color: BODY_COLORS[idx],
        linewidth: 1,
        scale: 1,
        dashSize: 10,
        gapSize: 10,
      })
  );
  return trajectories.map(
    (_, idx) => new THREE.Line(geometries[idx], materials[idx])
  );
}

function initScene(...objects: THREE.Object3D[]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const renderer = new THREE.WebGLRenderer();
  const controls = new OrbitControls(camera);

  renderer.setSize(window.innerWidth, window.innerHeight);
  scene.add(...objects);
  camera.position.z = 75;

  document.body.appendChild(renderer.domElement);

  return { renderer, scene, camera, controls };
}

function updateSimulation(field: Field, trajectories: BufferCurve[]) {
  // updating the position and speed of the points in field
  for (let t = 0; t < delta; t += dt) {
    field.update();
  }
  time += (delta * speed) / SECS_PER_DAY;

  trajectories.forEach((trajectory, idx) => {
    trajectory.push(field.points[idx].position);
  });
}

function updateObjectSpheres(field: Field, spheres: THREE.Mesh[]) {
  // updating spheres position in sphere according to current position of points in field
  spheres.forEach((sphere, idx) => {
    const position = field.points[idx].position.xyz;
    sphere.position.set(...position).multiplyScalar(scale);
  });
}

function updateObjectLines(trajectories: BufferCurve[], lines: THREE.Mesh[]) {
  lines.forEach((line, idx) => {
    const geometry = line.geometry as THREE.Geometry;
    geometry.vertices.forEach((vertex, vIdx) => {
      const position = trajectories[idx].get(vIdx).xyz;
      vertex.set(...position).multiplyScalar(scale);
    });

    geometry.verticesNeedUpdate = true;
    geometry.normalsNeedUpdate = true;
  });
}

function init() {
  const { field, trajectories } = initSimulation();
  const spheres = initObjectSpheres(field.points);
  const lines = initObjectLines(trajectories);
  const { renderer, scene, camera, controls } = initScene(...spheres, ...lines);

  return function animate() {
    updateSimulation(field, trajectories);
    updateObjectSpheres(field, spheres);
    updateObjectLines(trajectories, lines);

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
}

// SIMULATION LOOP

const animate = init();
animate();
