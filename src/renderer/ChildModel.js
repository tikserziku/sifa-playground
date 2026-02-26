import * as THREE from 'three';

/**
 * Procedural stylized child character model (Meta Horizon / Rec Room style)
 * Each child has: big round head, expressive face, hair, small body, arms, legs
 */

// Per-character appearance config
const CHILD_STYLES = [
  {
    // Ваня (red) — boy, spiky hair, t-shirt
    skinColor: 0xFFDBAC,
    hairColor: 0x8B4513,
    hairStyle: 'spiky',
    shirtColor: 0xE74C3C,
    pantsColor: 0x2C3E50,
    shoeColor: 0x333333,
    eyeSize: 1.0,
    headScale: 1.0,
  },
  {
    // Маша (pink) — girl, pigtails, dress
    skinColor: 0xFFDBAC,
    hairColor: 0xDAA520,
    hairStyle: 'pigtails',
    shirtColor: 0xFF69B4,
    pantsColor: 0xFF69B4,
    shoeColor: 0xFFFFFF,
    eyeSize: 1.15,
    headScale: 0.95,
  },
  {
    // Коля (blue) — boy, cap, hoodie
    skinColor: 0xD2A67D,
    hairColor: 0x222222,
    hairStyle: 'cap',
    shirtColor: 0x3498DB,
    pantsColor: 0x34495E,
    shoeColor: 0x2C3E50,
    eyeSize: 0.95,
    headScale: 1.05,
  },
  {
    // Даша (yellow) — girl, ponytail, vest
    skinColor: 0xFFDBAC,
    hairColor: 0xB7410E,
    hairStyle: 'ponytail',
    shirtColor: 0xF39C12,
    pantsColor: 0x8E44AD,
    shoeColor: 0xE74C3C,
    eyeSize: 1.1,
    headScale: 0.98,
  },
  {
    // Петя (green) — boy, messy hair, big shoes
    skinColor: 0xC68642,
    hairColor: 0x654321,
    hairStyle: 'messy',
    shirtColor: 0x2ECC71,
    pantsColor: 0x2980B9,
    shoeColor: 0xF39C12,
    eyeSize: 1.2,
    headScale: 1.08,
  },
];

export function createChildModel(agentId, accentColor) {
  const style = CHILD_STYLES[agentId % CHILD_STYLES.length];
  const group = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: style.skinColor });
  const shirtMat = new THREE.MeshLambertMaterial({ color: style.shirtColor });
  const pantsMat = new THREE.MeshLambertMaterial({ color: style.pantsColor });
  const hairMat = new THREE.MeshLambertMaterial({ color: style.hairColor });
  const shoeMat = new THREE.MeshLambertMaterial({ color: style.shoeColor });

  // === HEAD (big, round — child proportions) ===
  const headRadius = 0.22 * style.headScale;
  const headGeo = new THREE.SphereGeometry(headRadius, 12, 10);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.58;
  head.castShadow = true;
  group.add(head);

  // === FACE ===
  // Eyes (big and expressive)
  const eyeSize = 0.045 * style.eyeSize;
  const eyeGeo = new THREE.SphereGeometry(eyeSize, 8, 8);
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const pupilGeo = new THREE.SphereGeometry(eyeSize * 0.55, 6, 6);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const irisGeo = new THREE.SphereGeometry(eyeSize * 0.75, 6, 6);
  const irisMat = new THREE.MeshBasicMaterial({ color: agentId === 2 ? 0x4488FF : 0x664422 });

  [-0.08, 0.08].forEach(xOff => {
    const eyeWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eyeWhite.position.set(xOff, 0.60, headRadius * 0.85);
    group.add(eyeWhite);

    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(xOff, 0.60, headRadius * 0.85 + eyeSize * 0.3);
    group.add(iris);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(xOff, 0.60, headRadius * 0.85 + eyeSize * 0.55);
    group.add(pupil);

    // Eyebrow (small line above eye)
    const browGeo = new THREE.BoxGeometry(eyeSize * 1.8, 0.012, 0.012);
    const browMat = new THREE.MeshLambertMaterial({ color: style.hairColor });
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(xOff, 0.635, headRadius * 0.82);
    group.add(brow);
  });

  // Nose (tiny bump)
  const noseGeo = new THREE.SphereGeometry(0.025, 6, 4);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, 0.565, headRadius * 0.95);
  group.add(nose);

  // Mouth (smile curve)
  const smileShape = new THREE.Shape();
  smileShape.absarc(0, 0, 0.04, Math.PI * 0.15, Math.PI * 0.85, false);
  const smileGeo = new THREE.ShapeGeometry(smileShape, 8);
  const smileMat = new THREE.MeshBasicMaterial({ color: 0xCC4444, side: THREE.DoubleSide });
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.position.set(0, 0.525, headRadius * 0.9);
  smile.rotation.z = Math.PI;
  group.add(smile);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.04, 6, 6);
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * (headRadius * 0.9), 0.58, 0);
    ear.scale.set(0.6, 1, 0.8);
    group.add(ear);
  });

  // Cheeks (blush)
  const cheekGeo = new THREE.CircleGeometry(0.03, 8);
  const cheekMat = new THREE.MeshBasicMaterial({
    color: 0xFF8888,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  [-0.13, 0.13].forEach(xOff => {
    const cheek = new THREE.Mesh(cheekGeo, cheekMat);
    cheek.position.set(xOff, 0.555, headRadius * 0.88);
    group.add(cheek);
  });

  // === HAIR ===
  buildHair(group, style, headRadius);

  // === BODY (torso — shirt/dress) ===
  const torsoGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.25, 8);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 0.33;
  torso.castShadow = true;
  group.add(torso);

  // Collar
  const collarGeo = new THREE.TorusGeometry(0.13, 0.02, 6, 12);
  const collarMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.y = 0.44;
  collar.rotation.x = Math.PI / 2;
  group.add(collar);

  // === ARMS (with pivot for animation) ===
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.17, 0.42, 0); // shoulder joint
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.17, 0.42, 0);

  [leftArmPivot, rightArmPivot].forEach((pivot, i) => {
    const side = i === 0 ? -1 : 1;
    // Upper arm (hangs from pivot)
    const armGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.16, 6);
    const arm = new THREE.Mesh(armGeo, shirtMat);
    arm.position.set(0, -0.08, 0);
    arm.castShadow = true;
    pivot.add(arm);

    // Hand at bottom of arm
    const handGeo = new THREE.SphereGeometry(0.038, 6, 6);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(0, -0.18, 0);
    pivot.add(hand);

    group.add(pivot);
  });

  // Store arm refs for animation
  group.userData.leftArm = leftArmPivot;
  group.userData.rightArm = rightArmPivot;

  // === LEGS (with pivot for animation) ===
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.07, 0.2, 0); // hip joint
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.07, 0.2, 0);

  [leftLegPivot, rightLegPivot].forEach((pivot, i) => {
    // Upper leg (hangs from pivot)
    const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.16, 6);
    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.set(0, -0.08, 0);
    leg.castShadow = true;
    pivot.add(leg);

    // Shoe at bottom
    const shoeGeo = new THREE.BoxGeometry(0.07, 0.04, 0.11);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -0.18, 0.015);
    shoe.castShadow = true;
    pivot.add(shoe);

    group.add(pivot);
  });

  // Store leg refs for animation
  group.userData.leftLeg = leftLegPivot;
  group.userData.rightLeg = rightLegPivot;

  // === ACCENT STRIPE (team color on shirt) ===
  const stripeGeo = new THREE.CylinderGeometry(0.135, 0.145, 0.04, 8);
  const stripeMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.34;
  group.add(stripe);

  // === NAME TAG (number on back) ===
  // Small circle with number color
  const tagGeo = new THREE.CircleGeometry(0.06, 8);
  const tagMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
  const tag = new THREE.Mesh(tagGeo, tagMat);
  tag.position.set(0, 0.35, -0.155);
  tag.rotation.y = Math.PI;
  group.add(tag);

  return group;
}

function buildHair(group, style, headRadius) {
  const hairMat = new THREE.MeshLambertMaterial({ color: style.hairColor });

  switch (style.hairStyle) {
    case 'spiky': {
      // Spiky boy hair — several cones
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const r = headRadius * 0.6;
        const spikeGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
        const spike = new THREE.Mesh(spikeGeo, hairMat);
        spike.position.set(
          Math.cos(angle) * r,
          0.73 + Math.random() * 0.04,
          Math.sin(angle) * r
        );
        spike.rotation.x = Math.cos(angle) * 0.3;
        spike.rotation.z = -Math.sin(angle) * 0.3;
        group.add(spike);
      }
      // Top tuft
      const topGeo = new THREE.ConeGeometry(0.05, 0.12, 4);
      const top = new THREE.Mesh(topGeo, hairMat);
      top.position.set(0, 0.8, 0);
      group.add(top);
      break;
    }

    case 'pigtails': {
      // Girl hair — hair cap + two pigtails
      const capGeo = new THREE.SphereGeometry(headRadius * 1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.y = 0.60;
      group.add(cap);

      // Pigtails
      [-1, 1].forEach(side => {
        const tailGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 6);
        const tail = new THREE.Mesh(tailGeo, hairMat);
        tail.position.set(side * 0.18, 0.58, -0.05);
        tail.rotation.z = side * 0.5;
        group.add(tail);

        // Ball at end
        const ballGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const ball = new THREE.Mesh(ballGeo, hairMat);
        ball.position.set(side * 0.24, 0.50, -0.05);
        group.add(ball);

        // Hair tie (rubber band)
        const tieGeo = new THREE.TorusGeometry(0.03, 0.008, 6, 8);
        const tieMat = new THREE.MeshBasicMaterial({ color: 0xFF1493 });
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(side * 0.18, 0.56, -0.05);
        tie.rotation.z = side * 0.5;
        group.add(tie);
      });
      break;
    }

    case 'cap': {
      // Baseball cap
      const capGeo = new THREE.SphereGeometry(headRadius * 1.1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
      const capMat = new THREE.MeshLambertMaterial({ color: 0x3498DB });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.60;
      group.add(cap);

      // Visor
      const visorGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.02, 8, 1, false, -Math.PI * 0.35, Math.PI * 0.7);
      const visor = new THREE.Mesh(visorGeo, capMat);
      visor.position.set(0, 0.65, headRadius * 0.7);
      visor.rotation.x = -0.2;
      group.add(visor);

      // Hair peeking from under cap (short)
      const peekGeo = new THREE.BoxGeometry(0.3, 0.03, 0.08);
      const peek = new THREE.Mesh(peekGeo, hairMat);
      peek.position.set(0, 0.53, -headRadius * 0.6);
      group.add(peek);
      break;
    }

    case 'ponytail': {
      // Girl hair with ponytail
      const capGeo = new THREE.SphereGeometry(headRadius * 1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.y = 0.59;
      group.add(cap);

      // Bangs
      const bangGeo = new THREE.BoxGeometry(0.2, 0.035, 0.06);
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(0, 0.66, headRadius * 0.65);
      group.add(bang);

      // Ponytail (curves down)
      const tailGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.22, 6);
      const tail = new THREE.Mesh(tailGeo, hairMat);
      tail.position.set(0, 0.62, -headRadius * 0.8);
      tail.rotation.x = 0.5;
      group.add(tail);

      // Hair tie
      const tieGeo = new THREE.TorusGeometry(0.04, 0.008, 6, 8);
      const tieMat = new THREE.MeshBasicMaterial({ color: 0xF39C12 });
      const tie = new THREE.Mesh(tieGeo, tieMat);
      tie.position.set(0, 0.68, -headRadius * 0.65);
      tie.rotation.x = 0.5;
      group.add(tie);
      break;
    }

    case 'messy': {
      // Messy/curly boy hair — bunch of overlapping spheres
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const r = headRadius * (0.5 + Math.random() * 0.3);
        const ballGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.03, 6, 6);
        const ball = new THREE.Mesh(ballGeo, hairMat);
        ball.position.set(
          Math.cos(angle) * r,
          0.70 + Math.random() * 0.06,
          Math.sin(angle) * r
        );
        group.add(ball);
      }
      // Top mop
      const mopGeo = new THREE.SphereGeometry(0.12, 8, 6);
      const mop = new THREE.Mesh(mopGeo, hairMat);
      mop.position.set(0, 0.74, 0.02);
      group.add(mop);
      break;
    }
  }
}
