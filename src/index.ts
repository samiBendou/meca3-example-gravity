import { Field, Point } from "meca3";
import { BufferCurve, Vector3, Vector6 } from "space3";
import * as THREE from "three";

const BUFFER_LENGTH = 128000;

// INITIALIZATION OF THE SIMULATION

let day = 86400; // day in s
let month = 2.628e6; // month in s
let g = 6.67408e-11; // universal gravitation constant in SI

// The array bellow are ordered as [sun, earth]
let x = [0, 1.47098074e11]; // initial x position in m
let vy = [0, 3.0287e4]; // initial y speed in m/s
let mass = [1.9891e30, 5.9736e24]; // mass in kg
let speed = month; // simulation speed
let framerate = 60; // framerate of animation in frame/s
let delta = 1 / framerate; // time step of animation in s
let scale = 1e-10; // scaling factor to represent bodies in animation
let dt = delta / 2048; // time step = delta / number of samples per frame
let points = mass.map(
  (m, idx) =>
    new Point(
      Vector3.ex.mul(x[idx]),
      Vector3.ey.mul(vy[idx]),
      new BufferCurve(
        new Array(BUFFER_LENGTH)
          .fill(undefined)
          .map(() => new Vector6(x[idx], 0, 0, 0, vy[idx], 0))
      ),
      m
    )
);

// gravitational field between earth and sun
let makeField = (points) =>
  points.map((p: Point) => (u: Vector6) => {
    const acceleration: Vector3 = points.reduce((acc, point) => {
      const pos = new Vector3(...u.upper);
      const dist3 = point.position.dist(pos) ** 3 || Number.POSITIVE_INFINITY;
      const k = (g * point.mass) / dist3;
      return acc.add(point.position.sub(pos).mul(k));
    }, Vector3.zeros);
    u.upper = p.speed.array();
    u.lower = acceleration.array();
    return u;
  });

let field = new Field(points, makeField, Vector6.zeros, dt * speed);
let time = 0;

points.forEach((point, index) => {
  console.log(
    `points[${index}](${Math.floor(time)}) = ${point.position.toString()}`
  );
});

// INITIALIZATION OF 3D SCENE

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
let renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// The points in simulation are represented as spheres of different colors.
let geometry = new THREE.SphereGeometry(2);
let colors = [0xffff00, 0x00ffff]; //, 0xff00ff];
let materials = colors.map(
  (color) => new THREE.MeshBasicMaterial({ color: color })
);
let trajectoryGeometries = points.map((point) => {
  const geometry = new THREE.Geometry();
  geometry.vertices = point.trajectory.positions.map(
    (p) => new THREE.Vector3(p.x * scale, p.y * scale, p.z * scale)
  );
  return geometry;
});
let trajectoryMaterials = colors.map(
  (color) =>
    new THREE.LineDashedMaterial({
      color: color,
      linewidth: 10,
      scale: 1,
      dashSize: 3,
      gapSize: 1,
    })
);
let trajectoryLines = colors.map(
  (_, idx) =>
    new THREE.Line(trajectoryGeometries[idx], trajectoryMaterials[idx])
);

let spheres = materials.map((material) => new THREE.Mesh(geometry, material));
scene.add(...spheres, ...trajectoryLines);

camera.position.z = 75;

// SIMULATION LOOP

function animate() {
  // updating spheres position in sphere according to current position of points in field
  spheres.forEach((sphere, idx) => {
    sphere.position.x = field.points[idx].position.x * scale;
    sphere.position.y = field.points[idx].position.y * scale;
    sphere.position.z = field.points[idx].position.z * scale;
  });

  trajectoryGeometries.forEach((geometry, idx) => {
    for (let vIdx = 0; vIdx < BUFFER_LENGTH; vIdx++) {
      const position = field.points[idx].trajectory.positions[vIdx].upper;
      geometry.vertices[vIdx].x = position[0] * scale;
      geometry.vertices[vIdx].y = position[1] * scale;
      geometry.vertices[vIdx].z = position[2] * scale;
    }

    geometry.verticesNeedUpdate = true;
    geometry.normalsNeedUpdate = true;
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
