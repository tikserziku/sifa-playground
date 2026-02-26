import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Playground {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.buildGround();
    this.buildFence();
    this.buildSlide();
    this.buildSwings();
    this.buildSandbox();
    this.buildMonkeyBars();
    this.buildMerryGoRound();
    this.buildTrees();
    this.buildBenches();
  }

  // Helper: add mesh + physics body
  addStatic(mesh, shape, position, quaternion) {
    mesh.position.copy(position);
    if (quaternion) mesh.quaternion.copy(quaternion);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, shape });
    body.position.copy(position);
    if (quaternion) body.quaternion.copy(quaternion);
    this.world.addBody(body);
    return body;
  }

  buildGround() {
    // Visual ground
    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x7CBA5C });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Dirt path area (central)
    const pathGeo = new THREE.CircleGeometry(6, 32);
    const pathMat = new THREE.MeshLambertMaterial({ color: 0xC4A96A });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.01;
    this.scene.add(path);

    // Physics ground
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);
  }

  buildFence() {
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
    const railGeo = new THREE.BoxGeometry(2, 0.08, 0.06);
    const SIZE = 18;

    for (let side = 0; side < 4; side++) {
      for (let i = -SIZE; i <= SIZE; i += 2) {
        const post = new THREE.Mesh(postGeo, fenceMat);
        const x = side < 2 ? i : (side === 2 ? -SIZE : SIZE);
        const z = side < 2 ? (side === 0 ? -SIZE : SIZE) : i;
        post.position.set(x, 0.6, z);
        post.castShadow = true;
        this.scene.add(post);
      }
    }

    // Fence collision walls (invisible)
    const wallShape = new CANNON.Box(new CANNON.Vec3(SIZE, 1, 0.2));
    [
      [0, 1, -SIZE], [0, 1, SIZE], [-SIZE, 1, 0], [SIZE, 1, 0]
    ].forEach(([x, y, z], i) => {
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(wallShape);
      body.position.set(x, y, z);
      if (i >= 2) body.quaternion.setFromEuler(0, Math.PI / 2, 0);
      this.world.addBody(body);
    });
  }

  buildSlide() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xE74C3C });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    // Slide surface
    const slideGeo = new THREE.BoxGeometry(1.4, 0.1, 3.5);
    const slide = new THREE.Mesh(slideGeo, mat);
    slide.position.set(-8, 1.8, -6);
    slide.rotation.x = -0.45;
    slide.castShadow = true;
    this.scene.add(slide);

    // Support poles
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3, 8);
    [[-8.5, 1.5, -7.8], [-7.5, 1.5, -7.8]].forEach(([x, y, z]) => {
      const pole = new THREE.Mesh(poleGeo, metalMat);
      pole.position.set(x, y, z);
      pole.castShadow = true;
      this.scene.add(pole);
    });

    // Platform at top
    const platGeo = new THREE.BoxGeometry(1.6, 0.15, 1.2);
    const plat = new THREE.Mesh(platGeo, metalMat);
    plat.position.set(-8, 3, -8);
    plat.castShadow = true;
    this.scene.add(plat);

    // Slide collision
    const slideBody = new CANNON.Body({ mass: 0 });
    slideBody.addShape(new CANNON.Box(new CANNON.Vec3(0.7, 1.5, 1.75)));
    slideBody.position.set(-8, 1.5, -6.5);
    this.world.addBody(slideBody);
  }

  buildSwings() {
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x3498DB });

    // A-frame poles
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.5, 8);
    const topBarGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 8);

    const topBar = new THREE.Mesh(topBarGeo, metalMat);
    topBar.position.set(6, 3.2, -7);
    topBar.rotation.z = Math.PI / 2;
    topBar.castShadow = true;
    this.scene.add(topBar);

    // A-frame legs
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([xOff, zOff]) => {
      const pole = new THREE.Mesh(poleGeo, metalMat);
      pole.position.set(6 + xOff * 1.8, 1.75, -7 + zOff * 0.4);
      pole.rotation.z = xOff * 0.15;
      pole.castShadow = true;
      this.scene.add(pole);
    });

    // 2 swing seats
    const chainGeo = new THREE.CylinderGeometry(0.015, 0.015, 2.5, 4);
    const seatGeo = new THREE.BoxGeometry(0.5, 0.05, 0.3);
    [-0.8, 0.8].forEach(offset => {
      // Chains
      [-0.2, 0.2].forEach(cOff => {
        const chain = new THREE.Mesh(chainGeo, metalMat);
        chain.position.set(6 + offset, 2, -7 + cOff);
        this.scene.add(chain);
      });
      // Seat
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(6 + offset, 0.7, -7);
      seat.castShadow = true;
      this.scene.add(seat);
    });

    // Swing collision (simplified box for the frame)
    const swingBody = new CANNON.Body({ mass: 0 });
    swingBody.addShape(new CANNON.Box(new CANNON.Vec3(2, 1.8, 0.5)));
    swingBody.position.set(6, 1.8, -7);
    this.world.addBody(swingBody);
  }

  buildSandbox() {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xA0784C });
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xF0D9A0 });

    // Frame (4 sides)
    const sideGeo = new THREE.BoxGeometry(4, 0.4, 0.2);
    const shortGeo = new THREE.BoxGeometry(0.2, 0.4, 4);
    [
      { geo: sideGeo, pos: [0, 0.2, -2] },
      { geo: sideGeo, pos: [0, 0.2, 2] },
      { geo: shortGeo, pos: [-2, 0.2, 0] },
      { geo: shortGeo, pos: [2, 0.2, 0] },
    ].forEach(({ geo, pos }) => {
      const side = new THREE.Mesh(geo, woodMat);
      side.position.set(pos[0] + 0, pos[1], pos[2] + 7);
      side.castShadow = true;
      this.scene.add(side);
    });

    // Sand fill
    const sandGeo = new THREE.BoxGeometry(3.8, 0.15, 3.8);
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.set(0, 0.08, 7);
    sand.receiveShadow = true;
    this.scene.add(sand);

    // Low collision (agents can step over)
    const sandBody = new CANNON.Body({ mass: 0 });
    sandBody.addShape(new CANNON.Box(new CANNON.Vec3(2, 0.2, 2)));
    sandBody.position.set(0, 0.2, 7);
    this.world.addBody(sandBody);
  }

  buildMonkeyBars() {
    const metalMat = new THREE.MeshLambertMaterial({ color: 0xEE8822 });
    const baseX = -7, baseZ = 5;

    // Upright poles (4)
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3, 8);
    [[-1.5, -0.5], [-1.5, 0.5], [1.5, -0.5], [1.5, 0.5]].forEach(([xo, zo]) => {
      const pole = new THREE.Mesh(poleGeo, metalMat);
      pole.position.set(baseX + xo, 1.5, baseZ + zo);
      pole.castShadow = true;
      this.scene.add(pole);
    });

    // Top bars (rungs)
    const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
    for (let i = -1.2; i <= 1.2; i += 0.4) {
      const rung = new THREE.Mesh(rungGeo, metalMat);
      rung.position.set(baseX + i, 3, baseZ);
      rung.rotation.x = Math.PI / 2;
      this.scene.add(rung);
    }

    // Side rails
    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6);
    [-0.5, 0.5].forEach(zo => {
      const rail = new THREE.Mesh(railGeo, metalMat);
      rail.position.set(baseX, 3, baseZ + zo);
      rail.rotation.z = Math.PI / 2;
      this.scene.add(rail);
    });

    // Collision
    const barsBody = new CANNON.Body({ mass: 0 });
    barsBody.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 0.5)));
    barsBody.position.set(baseX, 1.5, baseZ);
    this.world.addBody(barsBody);
  }

  buildMerryGoRound() {
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x22AA44 });
    const platMat = new THREE.MeshLambertMaterial({ color: 0xDD4444 });
    const baseX = 8, baseZ = 5;

    // Center pole
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    const pole = new THREE.Mesh(poleGeo, metalMat);
    pole.position.set(baseX, 0.4, baseZ);
    pole.castShadow = true;
    this.scene.add(pole);

    // Platform disc
    const discGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.12, 16);
    this.merryDisc = new THREE.Mesh(discGeo, platMat);
    this.merryDisc.position.set(baseX, 0.35, baseZ);
    this.merryDisc.castShadow = true;
    this.scene.add(this.merryDisc);

    // Handles
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const handle = new THREE.Mesh(handleGeo, metalMat);
      handle.position.set(
        baseX + Math.cos(a) * 1.2,
        0.6,
        baseZ + Math.sin(a) * 1.2
      );
      this.merryDisc.add(handle);
      handle.position.sub(this.merryDisc.position);
    }

    // Collision
    const merryBody = new CANNON.Body({ mass: 0 });
    merryBody.addShape(new CANNON.Cylinder(1.5, 1.5, 0.5, 8));
    merryBody.position.set(baseX, 0.25, baseZ);
    this.world.addBody(merryBody);

    // Animate rotation
    this.merryAngle = 0;
  }

  buildTrees() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2D8B2D });
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6);
    const leafGeo = new THREE.SphereGeometry(1.5, 8, 6);

    const positions = [
      [-14, -14], [14, -14], [-14, 10], [13, 12],
      [-10, 14], [10, -12], [-15, 0], [15, 3],
    ];

    positions.forEach(([x, z]) => {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1.25, z);
      trunk.castShadow = true;
      this.scene.add(trunk);

      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 3.2, z);
      leaves.castShadow = true;
      this.scene.add(leaves);

      // Tree collision
      const treeBody = new CANNON.Body({ mass: 0 });
      treeBody.addShape(new CANNON.Cylinder(0.3, 0.3, 2.5, 6));
      treeBody.position.set(x, 1.25, z);
      this.world.addBody(treeBody);
    });
  }

  buildBenches() {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B6B3D });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

    const benchPositions = [
      { x: -12, z: 0, rot: Math.PI / 2 },
      { x: 12, z: -2, rot: -Math.PI / 2 },
      { x: 3, z: -13, rot: 0 },
    ];

    const seatGeo = new THREE.BoxGeometry(2, 0.1, 0.5);
    const backGeo = new THREE.BoxGeometry(2, 0.6, 0.08);
    const legGeo = new THREE.BoxGeometry(0.08, 0.5, 0.4);

    benchPositions.forEach(({ x, z, rot }) => {
      const group = new THREE.Group();

      const seat = new THREE.Mesh(seatGeo, woodMat);
      seat.position.y = 0.5;
      seat.castShadow = true;
      group.add(seat);

      const back = new THREE.Mesh(backGeo, woodMat);
      back.position.set(0, 0.85, -0.2);
      back.castShadow = true;
      group.add(back);

      [[-0.8, 0], [0.8, 0]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(lx, 0.25, lz);
        group.add(leg);
      });

      group.position.set(x, 0, z);
      group.rotation.y = rot;
      this.scene.add(group);

      // Bench collision
      const benchBody = new CANNON.Body({ mass: 0 });
      benchBody.addShape(new CANNON.Box(new CANNON.Vec3(1, 0.5, 0.3)));
      benchBody.position.set(x, 0.5, z);
      benchBody.quaternion.setFromEuler(0, rot, 0);
      this.world.addBody(benchBody);
    });
  }
}
